import type { Changeset } from "@workerbee/sync"
import { describe, expect, test } from "bun:test"
import { WorkspaceHubCore, type HubBufferStorage, type HubChangeSource } from "./hub"

function changeset(seq: number): Changeset {
  return {
    seq,
    at: new Date(seq * 1_000).toISOString(),
    actorId: "actor-1",
    changes: [
      {
        entity: "team",
        id: `team-${seq}`,
        teamId: null,
        op: "insert",
        patch: { id: `team-${seq}` },
      },
    ],
  }
}

class MemoryBuffer implements HubBufferStorage {
  values: readonly Changeset[] = []
  resetIsRequired = false

  async read(): Promise<Changeset[]> {
    return [...this.values]
  }

  async replace(changesets: readonly Changeset[]): Promise<void> {
    this.values = [...changesets]
  }

  async resetRequired(): Promise<boolean> {
    return this.resetIsRequired
  }

  async requireReset(): Promise<void> {
    this.resetIsRequired = true
  }
}

class MemorySource implements HubChangeSource {
  constructor(public values: readonly Changeset[]) {}

  async latestSeq(): Promise<number> {
    return this.values.at(-1)?.seq ?? 0
  }

  async changesSince(since: number, limit: number): Promise<Changeset[]> {
    return this.values.filter(({ seq }) => seq > since).slice(0, limit)
  }
}

describe("workspace hub core", () => {
  test("loads committed changes and replays them after a cursor", async () => {
    const source = new MemorySource([changeset(1), changeset(2)])
    const hub = new WorkspaceHubCore(new MemoryBuffer(), source)

    await expect(hub.replay(1, "all")).resolves.toEqual([
      { type: "changeset", changeset: changeset(2) },
    ])
  })

  test("reports a gap when the database no longer has the next sequence", async () => {
    const source = new MemorySource([changeset(1), changeset(3)])
    const storage = new MemoryBuffer()
    const hub = new WorkspaceHubCore(storage, source)

    await hub.refresh()

    await expect(hub.replay(1, "all")).resolves.toEqual([
      { type: "reset", reason: "gap" },
    ])
  })

  test("rebuilds the buffer and resets replay when the database sequence regresses", async () => {
    const source = new MemorySource([changeset(1), changeset(2), changeset(3), changeset(4)])
    const storage = new MemoryBuffer()
    const hub = new WorkspaceHubCore(storage, source, 4)

    await hub.refresh()
    source.values = [changeset(1), changeset(2)]

    await expect(hub.replay(1, "all")).resolves.toEqual([
      { type: "reset", reason: "gap" },
    ])
    expect(storage.values).toEqual([changeset(1), changeset(2)])

    const restartedHub = new WorkspaceHubCore(storage, source, 4)
    await expect(restartedHub.replay(1, "all")).resolves.toEqual([
      { type: "reset", reason: "gap" },
    ])
  })

  test("bounds cold-start hydration and resets clients older than the retained range", async () => {
    const source = new MemorySource([changeset(1), changeset(2), changeset(3), changeset(4)])
    const storage = new MemoryBuffer()
    const hub = new WorkspaceHubCore(storage, source, 2)

    await hub.refresh()

    expect(storage.values.map(({ seq }) => seq)).toEqual([3, 4])
    await expect(hub.replay(1, "all")).resolves.toEqual([
      { type: "reset", reason: "gap" },
    ])
    await expect(hub.replay(2, "all")).resolves.toEqual([
      { type: "changeset", changeset: changeset(3) },
      { type: "changeset", changeset: changeset(4) },
    ])
  })
})
