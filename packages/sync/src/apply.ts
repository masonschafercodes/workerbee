import type { Changeset } from "./changeset"

export type EntityRow = Readonly<Record<string, unknown>>
export type EntityStore = ReadonlyMap<string, ReadonlyMap<string, EntityRow>>

export type SyncSnapshot = {
  readonly lastSeq: number
  readonly entities: EntityStore
}

export const emptySnapshot: SyncSnapshot = { lastSeq: 0, entities: new Map() }

export type ApplyOutcome =
  | { readonly kind: "applied"; readonly snapshot: SyncSnapshot }
  | { readonly kind: "duplicate"; readonly snapshot: SyncSnapshot }
  | {
      readonly kind: "gap"
      readonly snapshot: SyncSnapshot
      readonly expected: number
      readonly received: number
    }

/**
 * An update to a row the client has never seen is treated as an insert. That
 * happens after a pruned gap, and healing is cheaper than a reset.
 */
export function applyChangeset(snapshot: SyncSnapshot, changeset: Changeset): ApplyOutcome {
  if (changeset.seq <= snapshot.lastSeq) {
    return { kind: "duplicate", snapshot }
  }

  if (changeset.seq !== snapshot.lastSeq + 1) {
    return {
      kind: "gap",
      snapshot,
      expected: snapshot.lastSeq + 1,
      received: changeset.seq,
    }
  }

  const entities = new Map(snapshot.entities)
  const buckets = new Map<string, Map<string, EntityRow>>()

  for (const change of changeset.changes) {
    let bucket = buckets.get(change.entity)

    if (bucket === undefined) {
      bucket = new Map(entities.get(change.entity) ?? [])
      buckets.set(change.entity, bucket)
      entities.set(change.entity, bucket)
    }

    if (change.op === "delete") {
      bucket.delete(change.id)
      continue
    }

    const previous = bucket.get(change.id)
    const row = change.op === "insert" ? { ...change.patch } : { ...previous, ...change.patch }

    bucket.set(change.id, row)
  }

  return { kind: "applied", snapshot: { lastSeq: changeset.seq, entities } }
}

export function row(
  snapshot: SyncSnapshot,
  entity: string,
  id: string,
): EntityRow | undefined {
  return snapshot.entities.get(entity)?.get(id)
}

export function rows(snapshot: SyncSnapshot, entity: string): readonly EntityRow[] {
  const bucket = snapshot.entities.get(entity)

  return bucket === undefined ? [] : [...bucket.values()]
}

export function nextSeq(snapshot: SyncSnapshot): number {
  return snapshot.lastSeq + 1
}
