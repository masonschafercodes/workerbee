import { describe, expect, test } from "bun:test"
import type { Changeset } from "@workerbee/realtime"
import type { Bootstrap } from "./types"
import { applyChangesetToBootstrap } from "./realtime-cache"

const initial: Bootstrap = {
  seq: 3,
  workspace: { id: "workspace-1", slug: "acme", name: "Acme" },
  teams: [],
  states: [],
  members: [],
  issues: [
    {
      id: "issue-1",
      teamId: "team-1",
      number: 1,
      identifier: "ENG-1",
      title: "First issue",
      stateId: "state-todo",
      priority: "none",
      assigneeId: null,
      parentId: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    },
  ],
  actor: { id: "actor-1", kind: "user" },
  teamScope: "all",
}

function change(seq: number, changes: Changeset["changes"]): Changeset {
  return { seq, at: "2026-01-01T00:00:00.000Z", actorId: "actor-1", changes }
}

describe("bootstrap realtime cache", () => {
  test("adds newly created issues and advances the cursor", () => {
    const outcome = applyChangesetToBootstrap(
      initial,
      change(4, [
        {
          entity: "issue",
          id: "issue-2",
          teamId: "team-1",
          op: "insert",
          patch: {
            id: "issue-2",
            teamId: "team-1",
            number: 2,
            identifier: "ENG-2",
            title: "Second issue",
            stateId: "state-todo",
            priority: "high",
            assigneeId: null,
            parentId: null,
            updatedAt: "2026-01-02T00:00:00.000Z",
            version: 1,
          },
        },
      ]),
    )

    expect(outcome.kind).toBe("applied")

    if (outcome.kind === "applied") {
      expect(outcome.bootstrap.seq).toBe(4)
      expect(outcome.bootstrap.issues.map((issue) => issue.identifier)).toEqual([
        "ENG-2",
        "ENG-1",
      ])
    }
  })

  test("applies an issue state change without losing optimistic cache data", () => {
    const outcome = applyChangesetToBootstrap(
      initial,
      change(4, [
        {
          entity: "issue",
          id: "issue-1",
          teamId: "team-1",
          op: "update",
          patch: { stateId: "state-done", version: 2 },
        },
      ]),
    )

    expect(outcome.kind).toBe("applied")

    if (outcome.kind === "applied") {
      expect(outcome.bootstrap.issues[0]).toMatchObject({
        stateId: "state-done",
        version: 2,
      })
    }
  })

  test("reports a gap without changing the bootstrap", () => {
    const outcome = applyChangesetToBootstrap(initial, change(5, []))

    expect(outcome).toEqual({ kind: "gap", bootstrap: initial })
  })

  test("ignores duplicate changesets", () => {
    expect(applyChangesetToBootstrap(initial, change(3, []))).toEqual({
      kind: "duplicate",
      bootstrap: initial,
    })
  })
})
