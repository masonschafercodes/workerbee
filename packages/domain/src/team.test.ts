import { describe, expect, test } from "bun:test"
import { newTeamId } from "./ids"
import { formatIdentifier, InvalidTeamKeyError, isTeamKey, parseIdentifier, teamKey } from "./team"

describe("team keys", () => {
  test("normalizes case and whitespace", () => {
    expect(String(teamKey(" eng "))).toBe("ENG")
  })

  test("rejects keys that do not start with a letter", () => {
    expect(() => teamKey("1NG")).toThrow(InvalidTeamKeyError)
    expect(() => teamKey("")).toThrow(InvalidTeamKeyError)
    expect(() => teamKey("TOOLONG")).toThrow(InvalidTeamKeyError)
  })

  test("recognizes valid keys without throwing", () => {
    expect(isTeamKey("OPS2")).toBe(true)
    expect(isTeamKey("ops")).toBe(false)
  })
})

describe("issue identifiers", () => {
  test("formats and parses round trip", () => {
    const key = teamKey("ENG")
    const identifier = formatIdentifier(key, 123)

    expect(String(identifier)).toBe("ENG-123")
    expect(parseIdentifier(identifier)).toEqual({ key, number: 123 })
  })

  test("rejects non-positive issue numbers", () => {
    expect(() => formatIdentifier(teamKey("ENG"), 0)).toThrow(RangeError)
    expect(() => formatIdentifier(teamKey("ENG"), 1.5)).toThrow(RangeError)
  })

  test("returns null for malformed identifiers", () => {
    expect(parseIdentifier("ENG")).toBeNull()
    expect(parseIdentifier("eng-1")).toBeNull()
    expect(parseIdentifier("ENG-0")).toBeNull()
  })
})

describe("team ids", () => {
  test("creates distinct team ids", () => {
    expect(newTeamId()).not.toBe(newTeamId())
  })
})
