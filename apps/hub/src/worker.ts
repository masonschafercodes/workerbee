import { createDb, TenantDb } from "@workerbee/db"
import { workspaceId, type WorkspaceId } from "@workerbee/domain"
import {
  HUB_BUFFER_CAPACITY,
  WorkspaceHubCore,
  parseChangeset,
  queueWakeupSchema,
  scopedChangesetFrame,
  verifyRealtimeTicket,
  type Changeset,
  type HubBufferStorage,
  type HubFrame,
  type HubRefresh,
} from "@workerbee/realtime"
import { z } from "zod"

type SqlStorage = {
  exec<T extends Record<string, unknown>>(query: string, ...bindings: unknown[]): Iterable<T>
  transactionSync<T>(callback: () => T): T
}

type DurableStorage = { readonly sql: SqlStorage }

type HibernatingSocket = WebSocket

type HubState = {
  readonly storage: DurableStorage
  getWebSockets(): HibernatingSocket[]
  acceptWebSocket(socket: HibernatingSocket): void
  blockConcurrencyWhile(callback: () => Promise<void>): Promise<void>
}

type DurableNamespace = {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(request: Request): Promise<Response> }
}

type QueueMessage = {
  readonly body: unknown
  ack(): void
  retry(): void
}

type Env = {
  readonly HYPERDRIVE: { readonly connectionString: string }
  readonly BETTER_AUTH_SECRET: string
  readonly HUB: DurableNamespace
}

type HubAttachment = {
  readonly teamIds: "all" | readonly string[]
}

const attachmentSchema = z.object({
  teamIds: z.union([z.literal("all"), z.array(z.string().min(1).max(64)).max(500)]),
})

function readAttachment(socket: HibernatingSocket): HubAttachment | null {
  const parsed = attachmentSchema.safeParse(socket.deserializeAttachment())

  return parsed.success ? parsed.data : null
}

class SqliteBuffer implements HubBufferStorage {
  constructor(private readonly sql: SqlStorage) {}

  async read(): Promise<Changeset[]> {
    const rows = this.sql.exec<{ payload: string }>(
      "SELECT payload FROM hub_changesets ORDER BY seq",
    )

    return Array.from(rows, (row) => parseChangeset(JSON.parse(row.payload)))
  }

  async replace(changesets: readonly Changeset[]): Promise<void> {
    this.sql.transactionSync(() => {
      this.sql.exec("DELETE FROM hub_changesets")

      for (const changeset of changesets.slice(-HUB_BUFFER_CAPACITY)) {
        this.sql.exec(
          "INSERT INTO hub_changesets (seq, payload) VALUES (?, ?)",
          changeset.seq,
          JSON.stringify(changeset),
        )
      }
    })
  }

  async resetRequired(): Promise<boolean> {
    const [row] = this.sql.exec<{ value: string }>(
      "SELECT value FROM hub_meta WHERE key = 'reset_required' LIMIT 1",
    )

    return row?.value === "true"
  }

  async requireReset(): Promise<void> {
    this.sql.exec(
      "INSERT INTO hub_meta (key, value) VALUES ('reset_required', 'true') " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
  }
}

export class WorkspaceHub {
  private readonly ready: Promise<void>
  private core: WorkspaceHubCore | null = null

  constructor(
    private readonly state: HubState,
    private readonly env: Env,
  ) {
    this.ready = state.blockConcurrencyWhile(async () => {
      state.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS hub_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
      )
      state.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS hub_changesets (seq INTEGER PRIMARY KEY, payload TEXT NOT NULL)",
      )
    })
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready

    const url = new URL(request.url)
    const path = url.pathname.split("/").filter(Boolean)

    const isWakeup = path.length === 3 && path[0] === "internal" && path[1] === "wake"
    const isRealtime =
      path.length === 4 && path[0] === "api" && path[1] === "v1" && path[2] === "realtime"

    if (!isWakeup && !isRealtime) {
      return new Response("Not found", { status: 404 })
    }

    const workspaceSegment = path.at(-1)

    if (workspaceSegment === undefined) {
      return new Response("Not found", { status: 404 })
    }

    let wid: WorkspaceId

    try {
      wid = workspaceId(workspaceSegment)
    } catch {
      return new Response("Invalid workspace", { status: 400 })
    }

    if (isWakeup && request.method === "POST") {
      return this.wake(request, wid)
    }

    if (isRealtime && request.method === "GET") {
      return this.connect(request, url, wid)
    }

    return new Response("Not found", { status: 404 })
  }

  async webSocketMessage(socket: HibernatingSocket): Promise<void> {
    socket.close(1008, "Hub is read-only")
  }

  async webSocketClose(): Promise<void> {}

  async webSocketError(socket: HibernatingSocket): Promise<void> {
    socket.close(1011, "Socket error")
  }

  private async bindWorkspace(workspace: WorkspaceId): Promise<boolean> {
    const [stored] = this.state.storage.sql.exec<{ value: string }>(
      "SELECT value FROM hub_meta WHERE key = 'workspace_id' LIMIT 1",
    )
    const key = workspace.toString()

    if (stored !== undefined) {
      if (stored.value !== key) {
        return false
      }
    } else {
      this.state.storage.sql.exec(
        "INSERT INTO hub_meta (key, value) VALUES ('workspace_id', ?)",
        key,
      )
    }

    return true
  }

  private async connect(request: Request, url: URL, workspace: WorkspaceId): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket required", { status: 426 })
    }

    const token = url.searchParams.get("ticket")
    const sinceValue = url.searchParams.get("since")
    const since = sinceValue === null ? null : Number(sinceValue)

    if (
      token === null ||
      since === null ||
      !Number.isSafeInteger(since) ||
      since < 0
    ) {
      return new Response("Invalid realtime request", { status: 400 })
    }

    const ticket = await verifyRealtimeTicket(token, this.env.BETTER_AUTH_SECRET, workspace)

    if (ticket === null) {
      return new Response("Unauthorized", { status: 401 })
    }

    if (!(await this.bindWorkspace(workspace))) {
      return new Response("Workspace mismatch", { status: 404 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.state.acceptWebSocket(server)
    server.serializeAttachment({ teamIds: ticket.teamIds })

    try {
      const replay = await this.coreFor(workspace).replayWithRefresh(since, ticket.teamIds)

      if (replay.refresh.kind === "reset") {
        this.broadcast(replay.refresh)
      }

      this.send(server, replay.frames)
    } catch {
      this.send(server, [{ type: "reset", reason: "gap" }])
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  private async wake(request: Request, workspace: WorkspaceId): Promise<Response> {
    let payload: unknown

    try {
      payload = await request.json()
    } catch {
      return new Response("Invalid JSON", { status: 400 })
    }

    const parsed = queueWakeupSchema.safeParse(payload)

    if (!parsed.success || parsed.data.workspaceId !== workspace) {
      return new Response("Invalid wakeup", { status: 400 })
    }

    if (!(await this.bindWorkspace(workspace))) {
      return new Response("Workspace mismatch", { status: 404 })
    }

    try {
      const result = await this.coreFor(workspace).refresh()
      this.broadcast(result)

      return new Response(null, { status: 204 })
    } catch {
      return new Response("Hub refresh failed", { status: 503 })
    }
  }

  private coreFor(workspace: WorkspaceId): WorkspaceHubCore {
    if (this.core !== null) {
      return this.core
    }

    const database = createDb(this.env.HYPERDRIVE.connectionString, 1)
    const tenant = new TenantDb(database.db, workspace)
    this.core = new WorkspaceHubCore(new SqliteBuffer(this.state.storage.sql), tenant)

    return this.core
  }

  private broadcast(result: HubRefresh): void {
    if (result.kind === "current") {
      return
    }

    for (const socket of this.state.getWebSockets()) {
      const attachment = readAttachment(socket)

      if (attachment === null) {
        socket.close(1008, "Invalid socket scope")
        continue
      }

      if (result.kind === "reset") {
        this.send(socket, [{ type: "reset", reason: "gap" }])
        continue
      }

      this.send(
        socket,
        result.changesets.flatMap((changeset) => {
          const frame = scopedChangesetFrame(changeset, attachment.teamIds)

          return frame === null ? [] : [frame]
        }),
      )
    }
  }

  private send(socket: HibernatingSocket, frames: readonly HubFrame[]): void {
    for (const frame of frames) {
      socket.send(JSON.stringify(frame))
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 })
  },
  async queue(batch: { readonly messages: readonly QueueMessage[] }, env: Env): Promise<void> {
    await Promise.all(
      batch.messages.map(async (message) => {
        const parsed = queueWakeupSchema.safeParse(message.body)

        if (!parsed.success) {
          message.ack()
          return
        }

        const id = env.HUB.idFromName(parsed.data.workspaceId)
        const stub = env.HUB.get(id)
        const response = await stub.fetch(
          new Request(`https://hub/internal/wake/${parsed.data.workspaceId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parsed.data),
          }),
        )

        if (response.ok) {
          message.ack()
        } else {
          message.retry()
        }
      }),
    )
  },
}
