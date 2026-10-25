import { describe, expect, test } from "bun:test"
import {
  actorId,
  InvalidIdError,
  isId,
  newId,
  newIssueId,
  newWorkspaceId,
  workspaceId,
} from "./ids"

describe("uuidv7 ids", () => {
  test("generates version 7 ids with the right variant", () => {
    const id = newId()

    expect(isId(id)).toBe(true)
    expect(id.charAt(14)).toBe("7")
    expect(["8", "9", "a", "b"]).toContain(id.charAt(19))
  })

  test("is unique across many generations", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId()))

    expect(ids.size).toBe(10_000)
  })

  test("encodes the current time in the prefix", () => {
    const before = Date.now()
    const id = newId()
    const after = Date.now()

    const hex = id.replaceAll("-", "").slice(0, 12)
    const timestamp = Number.parseInt(hex, 16)

    expect(Number.isFinite(timestamp)).toBe(true)
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  test("orders by time across milliseconds", async () => {
    const first = newId()
    await Bun.sleep(2)
    const second = newId()

    expect(first < second).toBe(true)
  })

  test("rejects values that are not uuids", () => {
    expect(() => workspaceId("ENG-123")).toThrow(InvalidIdError)
    expect(() => actorId("")).toThrow(InvalidIdError)
    expect(() => workspaceId("00000000-0000-4000-8000-000000000000")).toThrow(InvalidIdError)
  })

  test("accepts valid ids and keeps the string unchanged", () => {
    const generated = newWorkspaceId()

    expect(workspaceId(generated)).toBe(generated)
    expect(newIssueId()).not.toBe(generated)
  })
})
