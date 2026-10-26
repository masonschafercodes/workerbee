import type { Changeset } from "@workerbee/sync"
import { appendToBuffer, replayChangesets } from "./replay"
import type { HubFrame } from "./protocol"
import type { TeamScope } from "@workerbee/sync"

export type HubChangeSource = {
  latestSeq(): Promise<number>
  changesSince(since: number, limit: number): Promise<Changeset[]>
}

export type HubBufferStorage = {
  read(): Promise<Changeset[]>
  replace(changesets: readonly Changeset[]): Promise<void>
  resetRequired(): Promise<boolean>
  requireReset(): Promise<void>
}

export type HubRefresh =
  | { readonly kind: "current" }
  | { readonly kind: "updated"; readonly changesets: readonly Changeset[] }
  | { readonly kind: "reset"; readonly reason: "gap" | "rewound" }

export type HubReplay = {
  readonly refresh: HubRefresh
  readonly frames: readonly HubFrame[]
}

export const HUB_BUFFER_CAPACITY = 256
const MAX_FETCH = 500

export class WorkspaceHubCore {
  private inFlight: Promise<HubRefresh> = Promise.resolve({ kind: "current" })

  constructor(
    private readonly storage: HubBufferStorage,
    private readonly source: HubChangeSource,
    private readonly capacity = HUB_BUFFER_CAPACITY,
  ) {}

  refresh(): Promise<HubRefresh> {
    const next = this.inFlight.then(() => this.refreshLocked())
    this.inFlight = next.catch((): HubRefresh => ({ kind: "current" }))

    return next
  }

  async replay(since: number, scope: TeamScope): Promise<readonly HubFrame[]> {
    return (await this.replayWithRefresh(since, scope)).frames
  }

  async replayWithRefresh(since: number, scope: TeamScope): Promise<HubReplay> {
    const refresh = await this.refresh()

    if (refresh.kind === "reset" && refresh.reason === "rewound") {
      return { refresh, frames: [{ type: "reset", reason: "gap" }] }
    }

    if (await this.storage.resetRequired()) {
      return { refresh, frames: [{ type: "reset", reason: "gap" }] }
    }

    return { refresh, frames: replayChangesets(await this.storage.read(), since, scope) }
  }

  private async refreshLocked(): Promise<HubRefresh> {
    const buffered = await this.storage.read()
    const lastBuffered = buffered.at(-1)?.seq ?? 0
    const latest = await this.source.latestSeq()

    if (latest < lastBuffered) {
      const since = Math.max(0, latest - this.capacity)
      const rebuilt = await this.source.changesSince(since, this.capacity)
      await this.storage.requireReset()
      await this.storage.replace(rebuilt.slice(-this.capacity))

      return { kind: "reset", reason: "rewound" }
    }

    if (latest === lastBuffered) {
      return { kind: "current" }
    }

    const tailRequired =
      buffered.length === 0 || latest - lastBuffered > MAX_FETCH
    const since = tailRequired
      ? Math.max(0, latest - this.capacity)
      : lastBuffered
    const incoming = await this.source.changesSince(
      since,
      tailRequired ? this.capacity : MAX_FETCH,
    )
    const firstIncoming = incoming[0]?.seq
    const hasGap =
      incoming.length === 0 ||
      (!tailRequired && firstIncoming !== lastBuffered + 1) ||
      (tailRequired && latest - lastBuffered > 0 && firstIncoming !== lastBuffered + 1)

    if (tailRequired) {
      await this.storage.replace(incoming.slice(-this.capacity))

      return hasGap
        ? { kind: "reset", reason: "gap" }
        : { kind: "updated", changesets: incoming }
    }

    const combined = appendToBuffer(buffered, incoming, this.capacity)
    await this.storage.replace(combined)

    return hasGap
      ? { kind: "reset", reason: "gap" }
      : { kind: "updated", changesets: incoming }
  }
}
