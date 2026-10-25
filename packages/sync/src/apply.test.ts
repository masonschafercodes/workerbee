import { describe, expect, test } from "bun:test"
import { applyChangeset, emptySnapshot, row, rows, type SyncSnapshot } from "./apply"
import type { Changeset } from "./changeset"

type ChangeInput = Omit<Changeset["changes"][number], "teamId"> & { teamId?: string | null }

function changeset(seq: number, changes: ChangeInput[]): Changeset {
  return {
    seq,
    at: new Date().toISOString(),
    actorId: "actor-1",
    changes: changes.map((change) => ({ teamId: "team-1", ...change })),
  }
}

function apply(snapshot: SyncSnapshot, incoming: Changeset): SyncSnapshot {
  const outcome = applyChangeset(snapshot, incoming)

  if (outcome.kind !== "applied") {
    throw new Error(`expected applied, got ${outcome.kind}`)
  }

  return outcome.snapshot
}

describe("applying changesets", () => {
  test("inserts rows into their entity bucket", () => {
    const snapshot = apply(
      emptySnapshot,
      changeset(1, [{ entity: "issue", id: "a", op: "insert", patch: { title: "One" } }]),
    )

    expect(snapshot.lastSeq).toBe(1)
    expect(row(snapshot, "issue", "a")).toEqual({ title: "One" })
    expect(rows(snapshot, "issue")).toHaveLength(1)
  })

  test("updates merge into the existing row", () => {
    let snapshot = apply(
      emptySnapshot,
      changeset(1, [
        { entity: "issue", id: "a", op: "insert", patch: { title: "One", stateId: "todo" } },
      ]),
    )

    snapshot = apply(
      snapshot,
      changeset(2, [{ entity: "issue", id: "a", op: "update", patch: { stateId: "done" } }]),
    )

    expect(row(snapshot, "issue", "a")).toEqual({ title: "One", stateId: "done" })
  })

  test("deletes remove the row and leave other rows alone", () => {
    let snapshot = apply(
      emptySnapshot,
      changeset(1, [
        { entity: "issue", id: "a", op: "insert", patch: { title: "One" } },
        { entity: "issue", id: "b", op: "insert", patch: { title: "Two" } },
      ]),
    )

    snapshot = apply(snapshot, changeset(2, [{ entity: "issue", id: "a", op: "delete", patch: {} }]))

    expect(row(snapshot, "issue", "a")).toBeUndefined()
    expect(row(snapshot, "issue", "b")).toEqual({ title: "Two" })
  })

  test("an update to an unknown row heals as an insert", () => {
    const snapshot = apply(
      emptySnapshot,
      changeset(1, [{ entity: "issue", id: "a", op: "update", patch: { title: "Late" } }]),
    )

    expect(row(snapshot, "issue", "a")).toEqual({ title: "Late" })
  })

  test("changes in one changeset can build on each other", () => {
    const snapshot = apply(
      emptySnapshot,
      changeset(1, [
        { entity: "issue", id: "a", op: "insert", patch: { title: "One" } },
        { entity: "issue", id: "a", op: "update", patch: { stateId: "done" } },
        { entity: "comment", id: "c", op: "insert", patch: { body: "hi" } },
      ]),
    )

    expect(row(snapshot, "issue", "a")).toEqual({ title: "One", stateId: "done" })
    expect(row(snapshot, "comment", "c")).toEqual({ body: "hi" })
  })

  test("a duplicate seq is ignored without touching the snapshot", () => {
    const snapshot = apply(
      emptySnapshot,
      changeset(1, [{ entity: "issue", id: "a", op: "insert", patch: { title: "One" } }]),
    )

    const outcome = applyChangeset(
      snapshot,
      changeset(1, [{ entity: "issue", id: "b", op: "insert", patch: { title: "Two" } }]),
    )

    expect(outcome.kind).toBe("duplicate")
    expect(outcome.snapshot).toBe(snapshot)
  })

  test("a gap reports the expected seq and does not mutate", () => {
    const snapshot = apply(
      emptySnapshot,
      changeset(1, [{ entity: "issue", id: "a", op: "insert", patch: { title: "One" } }]),
    )

    const outcome = applyChangeset(
      snapshot,
      changeset(3, [{ entity: "issue", id: "b", op: "insert", patch: { title: "Three" } }]),
    )

    expect(outcome.kind).toBe("gap")

    if (outcome.kind === "gap") {
      expect(outcome.expected).toBe(2)
      expect(outcome.received).toBe(3)
    }

    expect(outcome.snapshot).toBe(snapshot)
    expect(row(snapshot, "issue", "b")).toBeUndefined()
  })

  test("the input snapshot is never mutated", () => {
    const before = apply(
      emptySnapshot,
      changeset(1, [{ entity: "issue", id: "a", op: "insert", patch: { title: "One" } }]),
    )
    const after = apply(
      before,
      changeset(2, [{ entity: "issue", id: "a", op: "update", patch: { title: "Changed" } }]),
    )

    expect(row(before, "issue", "a")).toEqual({ title: "One" })
    expect(row(after, "issue", "a")).toEqual({ title: "Changed" })
    expect(after.entities).not.toBe(before.entities)
  })

  test("empty entity buckets are created only when touched", () => {
    const snapshot = apply(
      emptySnapshot,
      changeset(1, [{ entity: "comment", id: "c", op: "insert", patch: { body: "hi" } }]),
    )

    expect(rows(snapshot, "issue")).toEqual([])
    expect([...snapshot.entities.keys()]).toEqual(["comment"])
  })
})
