import { describe, expect, test } from "bun:test"
import type { Changeset } from "@workerbee/realtime"
import type { Bootstrap, Issue } from "./types"
import { applyChangesetToBootstrap, applyIssueDetailChange } from "./realtime-cache"

const initial: Bootstrap = {
  seq: 3,
  workspace: { id: "workspace-1", slug: "acme", name: "Acme" },
  teams: [],
  states: [],
  members: [],
  labels: [],
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

  test("applies label inserts, renames, and deletes", () => {
    const inserted = applyChangesetToBootstrap(
      initial,
      change(4, [
        {
          entity: "label",
          id: "label-1",
          teamId: null,
          op: "insert",
          patch: { id: "label-1", name: "bug", color: "#d73a4a" },
        },
      ]),
    )

    expect(inserted.kind).toBe("applied")

    if (inserted.kind !== "applied") {
      return
    }

    expect(inserted.bootstrap.labels).toEqual([
      {
        id: "label-1",
        teamId: null,
        name: "bug",
        color: "#d73a4a",
      },
    ])

    const renamed = applyChangesetToBootstrap(
      inserted.bootstrap,
      change(5, [
        {
          entity: "label",
          id: "label-1",
          teamId: null,
          op: "update",
          patch: { name: "defect" },
        },
      ]),
    )

    expect(renamed.kind).toBe("applied")

    if (renamed.kind !== "applied") {
      return
    }

    expect(renamed.bootstrap.labels[0]?.name).toBe("defect")

    const deleted = applyChangesetToBootstrap(
      renamed.bootstrap,
      change(6, [
        {
          entity: "label",
          id: "label-1",
          teamId: null,
          op: "delete",
          patch: {},
        },
      ]),
    )

    expect(deleted.kind).toBe("applied")

    if (deleted.kind === "applied") {
      expect(deleted.bootstrap.labels).toEqual([])
    }
  })

  test("applies an issue label change to the open issue cache", () => {
    const summary = initial.issues[0]!
    const current: Issue = {
      ...summary,
      workspaceId: "workspace-1",
      description: "",
      creatorId: "actor-1",
      projectId: null,
      cycleId: null,
      estimate: null,
      dueDate: null,
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      labels: [],
    }

    const attached = applyIssueDetailChange(current, {
      entity: "issue",
      id: "issue-1",
      teamId: "team-1",
      op: "update",
      patch: {
        labels: [{ id: "label-1", teamId: null, name: "bug", color: "#d73a4a" }],
        version: 2,
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    })

    expect(attached?.labels).toEqual([
      { id: "label-1", teamId: null, name: "bug", color: "#d73a4a" },
    ])
    expect(attached?.version).toBe(2)

    const detached = applyIssueDetailChange(attached!, {
      entity: "issue",
      id: "issue-1",
      teamId: "team-1",
      op: "update",
      patch: { labels: [], version: 3, updatedAt: "2026-01-03T00:00:00.000Z" },
    })

    expect(detached?.labels).toEqual([])
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
