import { visibleChanges, type Changeset, type TeamScope } from "@workerbee/sync"
import type { HubFrame } from "./protocol"

export function scopedChangesetFrame(
  changeset: Changeset,
  scope: TeamScope,
): HubFrame | null {
  const visible = visibleChanges(changeset, scope)

  return visible === null ? null : { type: "changeset", changeset: visible }
}

export function replayChangesets(
  buffered: readonly Changeset[],
  since: number,
  scope: TeamScope,
): readonly HubFrame[] {
  if (buffered.length === 0) {
    return since === 0 ? [] : [{ type: "reset", reason: "gap" }]
  }

  const oldest = buffered[0]?.seq
  const newest = buffered.at(-1)?.seq

  if (oldest === undefined || newest === undefined || since < oldest - 1 || since > newest) {
    return [{ type: "reset", reason: "gap" }]
  }

  const missed = buffered.filter((changeset) => changeset.seq > since)
  let expected = since + 1

  for (const changeset of missed) {
    if (changeset.seq !== expected) {
      return [{ type: "reset", reason: "gap" }]
    }

    expected += 1
  }

  return missed.flatMap((changeset) => {
    const frame = scopedChangesetFrame(changeset, scope)

    return frame === null ? [] : [frame]
  })
}

export function appendToBuffer(
  buffered: readonly Changeset[],
  incoming: readonly Changeset[],
  capacity: number,
): readonly Changeset[] {
  const bySeq = new Map(buffered.map((changeset) => [changeset.seq, changeset]))

  for (const changeset of incoming) {
    const current = bySeq.get(changeset.seq)

    if (current === undefined) {
      bySeq.set(changeset.seq, changeset)
    }
  }

  return [...bySeq.values()]
    .sort((left, right) => left.seq - right.seq)
    .slice(-capacity)
}
