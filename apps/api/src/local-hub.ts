import type { Database } from "@workerbee/db"
import { TenantDb } from "@workerbee/db"
import type { WorkspaceId } from "@workerbee/domain"
import {
  WorkspaceHubCore,
  type ChangeNotification,
  type ChangePublisher,
  type HubBufferStorage,
  type HubConnection,
  type HubRefresh,
  type HubRouter,
  type RealtimeTicket,
  scopedChangesetFrame,
  verifyRealtimeTicket,
  type HubFrame,
} from "@workerbee/realtime"
import type { Changeset } from "@workerbee/sync"

export type HubSocketData = {
  readonly workspaceId: WorkspaceId
  readonly since: number
  readonly ticket: RealtimeTicket
}

export type LocalWebSocket = {
  readonly data: HubSocketData
  send(message: string): unknown
  close(code?: number, reason?: string): unknown
}

export type LocalWebSocketServer = {
  upgrade(request: Request, options: { data: HubSocketData }): boolean
}

class MemoryBuffer implements HubBufferStorage {
  private changesets: readonly Changeset[] = []
  private needsReset = false

  async read(): Promise<Changeset[]> {
    return [...this.changesets]
  }

  async replace(changesets: readonly Changeset[]): Promise<void> {
    this.changesets = [...changesets]
  }

  async resetRequired(): Promise<boolean> {
    return this.needsReset
  }

  async requireReset(): Promise<void> {
    this.needsReset = true
  }
}

export class LocalHub implements ChangePublisher, HubRouter {
  private readonly cores = new Map<string, WorkspaceHubCore>()
  private readonly sockets = new Map<string, Set<LocalWebSocket>>()
  private server: LocalWebSocketServer | null = null

  constructor(
    private readonly db: Database,
    private readonly secret: string,
  ) {}

  attach(server: LocalWebSocketServer): void {
    this.server = server
  }

  async connect(connection: HubConnection): Promise<Response> {
    const url = new URL(connection.request.url)
    const ticket = await verifyRealtimeTicket(
      connection.ticket,
      this.secret,
      connection.workspaceId,
    )

    if (
      ticket === null ||
      connection.request.headers.get("upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    if (url.pathname !== `/api/v1/realtime/${connection.workspaceId}`) {
      return new Response(JSON.stringify({ error: "invalid_realtime_path" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    if (this.server === null) {
      return new Response(JSON.stringify({ error: "realtime_unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })
    }

    const upgraded = this.server.upgrade(connection.request, {
      data: { workspaceId: connection.workspaceId, since: connection.since, ticket },
    })

    return new Response(null, { status: upgraded ? 200 : 400 })
  }

  async publish(notification: ChangeNotification): Promise<void> {
    const core = this.coreFor(notification.workspaceId)
    const result = await core.refresh()

    this.broadcast(notification.workspaceId, result)
  }

  readonly websocket = {
    open: (socket: LocalWebSocket): void => {
      const clients = this.sockets.get(socket.data.workspaceId) ?? new Set()
      clients.add(socket)
      this.sockets.set(socket.data.workspaceId, clients)
      void this.replayTo(socket)
    },
    message: (socket: LocalWebSocket): void => {
      socket.close(1008, "Hub is read-only")
    },
    close: (socket: LocalWebSocket): void => {
      const clients = this.sockets.get(socket.data.workspaceId)
      clients?.delete(socket)

      if (clients?.size === 0) {
        this.sockets.delete(socket.data.workspaceId)
      }
    },
    error: (_error: Error, socket: LocalWebSocket): void => {
      const clients = this.sockets.get(socket.data.workspaceId)
      clients?.delete(socket)
    },
  }

  private coreFor(workspace: WorkspaceId): WorkspaceHubCore {
    const key = workspace.toString()
    const existing = this.cores.get(key)

    if (existing !== undefined) {
      return existing
    }

    const tenant = new TenantDb(this.db, workspace)
    const core = new WorkspaceHubCore(new MemoryBuffer(), tenant)
    this.cores.set(key, core)

    return core
  }

  private async replayTo(socket: LocalWebSocket): Promise<void> {
    try {
      const workspace = socket.data.workspaceId
      const replay = await this.coreFor(workspace).replayWithRefresh(
        socket.data.since,
        socket.data.ticket.teamIds,
      )

      if (replay.refresh.kind === "reset") {
        this.broadcast(workspace, replay.refresh)
      }

      this.send(socket, replay.frames)
    } catch {
      this.send(socket, [{ type: "reset", reason: "gap" }])
    }
  }

  private broadcast(workspace: WorkspaceId, result: HubRefresh): void {
    if (result.kind === "current") {
      return
    }

    for (const socket of this.sockets.get(workspace) ?? []) {
      const frames: readonly HubFrame[] =
        result.kind === "reset"
          ? [{ type: "reset", reason: "gap" }]
          : result.changesets.flatMap((changeset) => {
              const frame = scopedChangesetFrame(changeset, socket.data.ticket.teamIds)

              return frame === null ? [] : [frame]
            })

      this.send(socket, frames)
    }
  }

  private send(socket: LocalWebSocket, frames: readonly HubFrame[]): void {
    for (const frame of frames) {
      socket.send(JSON.stringify(frame))
    }
  }
}
