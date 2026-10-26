import type { Changeset } from "@workerbee/sync"
import { describe, expect, test } from "bun:test"
import { appendToBuffer, replayChangesets } from "./replay"

function set(seq: number, teamId = "team-eng"): Changeset {
  return {
    seq,
    at: new Date(seq * 1_000).toISOString(),
    actorId: "actor-1",
    changes: [
      {
        entity: "issue",
        id: `issue-${seq}`,
        teamId,
        op: "insert",
        patch: { id: `issue-${seq}` },
      },
    ],
  }
}

describe("hub replay", () => {
  test("replays contiguous changesets after the requested cursor", () => {
    expect(replayChangesets([set(4), set(5)], 3, "all")).toEqual([
      { type: "changeset", changeset: set(4) },
      { type: "changeset", changeset: set(5) },
    ])
  })

  test("resets when the cursor predates the retained buffer", () => {
    expect(replayChangesets([set(4), set(5)], 2, "all")).toEqual([
      { type: "reset", reason: "gap" },
    ])
  })

  test("resets when the buffer has a missing sequence", () => {
    expect(replayChangesets([set(4), set(6)], 3, "all")).toEqual([
      { type: "reset", reason: "gap" },
    ])
  })

  test("does not publish changesets outside the socket's team scope", () => {
    expect(replayChangesets([set(1, "team-ops")], 0, ["team-eng"])).toEqual([])
  })

  test("leaves a visible sequence gap when hidden changesets were skipped", () => {
    expect(
      replayChangesets([set(1, "team-ops"), set(2, "team-eng")], 0, ["team-eng"]),
    ).toEqual([{ type: "changeset", changeset: set(2) }])
  })

  test("keeps only the newest bounded sequence range", () => {
    expect(appendToBuffer([set(1), set(2)], [set(3), set(2)], 2).map(({ seq }) => seq)).toEqual([
      2,
      3,
    ])
  })
})
