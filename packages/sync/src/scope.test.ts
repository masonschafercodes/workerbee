import { describe, expect, test } from "bun:test"
import type { Changeset } from "./changeset"
import { isVisible, visibleChanges } from "./scope"

function changeset(teamIds: (string | null)[]): Changeset {
  return {
    seq: 1,
    at: new Date().toISOString(),
    actorId: "actor-1",
    changes: teamIds.map((teamId, index) => ({
      entity: teamId === null ? "member" : "issue",
      id: `row-${index}`,
      teamId,
      op: "insert",
      patch: { index },
    })),
  }
}

describe("scoped fanout", () => {
  test("an unrestricted scope sees every change", () => {
    const all = changeset(["eng", "ops", null])

    expect(visibleChanges(all, "all")?.changes).toHaveLength(3)
  })

  test("a restricted scope sees its teams and workspace-level changes", () => {
    const all = changeset(["eng", "ops", null])
    const visible = visibleChanges(all, ["eng"])

    expect(visible?.changes.map((change) => change.teamId)).toEqual(["eng", null])
  })

  test("a changeset with nothing visible becomes null", () => {
    expect(visibleChanges(changeset(["ops"]), ["eng"])).toBeNull()
  })

  test("workspace-level changes are always visible", () => {
    expect(isVisible(changeset([null]).changes[0]!, ["eng"])).toBe(true)
  })

  test("a restricted scope does not see an unknown team", () => {
    expect(isVisible(changeset(["secret"]).changes[0]!, ["eng"])).toBe(false)
  })
})
