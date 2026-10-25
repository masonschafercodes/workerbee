import { describe, expect, test } from "bun:test"
import { changesetSchema, MAX_PATCH_BYTES, parseChangeset } from "./changeset"

function valid(overrides: Record<string, unknown> = {}) {
  return {
    seq: 1,
    at: new Date().toISOString(),
    actorId: "actor-1",
    changes: [
      { entity: "issue", id: "issue-1", teamId: "team-1", op: "insert", patch: { title: "Hello" } },
    ],
    ...overrides,
  }
}

describe("changeset schema", () => {
  test("accepts a well formed changeset", () => {
    expect(changesetSchema.parse(valid()).seq).toBe(1)
  })

  test("accepts workspace-level entities with a null team", () => {
    const result = changesetSchema.safeParse(
      valid({
        changes: [
          { entity: "member", id: "m-1", teamId: null, op: "insert", patch: { role: "member" } },
        ],
      }),
    )

    expect(result.success).toBe(true)
  })

  test("rejects a team-scoped entity with a null team", () => {
    const result = changesetSchema.safeParse(
      valid({
        changes: [{ entity: "issue", id: "i", teamId: null, op: "insert", patch: { title: "x" } }],
      }),
    )

    expect(result.success).toBe(false)
  })

  test("requires an explicit team scope on every change", () => {
    const result = changesetSchema.safeParse(
      valid({
        changes: [{ entity: "issue", id: "i", op: "insert", patch: { title: "x" } }],
      }),
    )

    expect(result.success).toBe(false)
  })

  test("rejects seq zero, since seq starts at one", () => {
    expect(changesetSchema.safeParse(valid({ seq: 0 })).success).toBe(false)
    expect(changesetSchema.safeParse(valid({ seq: 1.5 })).success).toBe(false)
  })

  test("rejects an empty change list", () => {
    expect(changesetSchema.safeParse(valid({ changes: [] })).success).toBe(false)
  })

  test("rejects a bad timestamp", () => {
    expect(changesetSchema.safeParse(valid({ at: "yesterday" })).success).toBe(false)
  })

  test("rejects a delete with a patch", () => {
    const result = changesetSchema.safeParse(
      valid({
        changes: [
          { entity: "issue", id: "i", teamId: "t", op: "delete", patch: { title: "x" } },
        ],
      }),
    )

    expect(result.success).toBe(false)
  })

  test("rejects an insert without a patch", () => {
    const result = changesetSchema.safeParse(
      valid({
        changes: [{ entity: "issue", id: "i", teamId: "t", op: "insert", patch: {} }],
      }),
    )

    expect(result.success).toBe(false)
  })

  test("rejects an unknown entity", () => {
    const result = changesetSchema.safeParse(
      valid({
        changes: [{ entity: "spaceship", id: "i", teamId: "t", op: "insert", patch: { a: 1 } }],
      }),
    )

    expect(result.success).toBe(false)
  })

  test("rejects an oversized patch counted in bytes", () => {
    const result = changesetSchema.safeParse(
      valid({
        changes: [
          {
            entity: "issue",
            id: "i",
            teamId: "t",
            op: "insert",
            patch: { body: "x".repeat(MAX_PATCH_BYTES) },
          },
        ],
      }),
    )

    expect(result.success).toBe(false)
  })

  test("rejects multibyte text that passes a character count but not a byte count", () => {
    // 5000 accented characters are 5000 UTF-16 units but 10000 UTF-8 bytes.
    const body = "é".repeat(5_000)

    expect(body.length).toBeLessThan(MAX_PATCH_BYTES)
    expect(new TextEncoder().encode(JSON.stringify({ body })).length).toBeGreaterThan(MAX_PATCH_BYTES)

    const result = changesetSchema.safeParse(
      valid({
        changes: [{ entity: "issue", id: "i", teamId: "t", op: "insert", patch: { body } }],
      }),
    )

    expect(result.success).toBe(false)
  })

  test("parseChangeset is the only entry point callers need", () => {
    expect(() => parseChangeset(valid())).not.toThrow()
    expect(() => parseChangeset({ seq: 1 })).toThrow()
  })
})
