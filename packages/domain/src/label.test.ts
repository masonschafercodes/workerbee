import { describe, expect, test } from "bun:test"
import { labelId, newTeamId } from "./ids"
import {
  InvalidLabelError,
  LABEL_NAME_MAX_LENGTH,
  labelAppliesToTeam,
  labelColor,
  labelName,
  labelScope,
} from "./label"

describe("label name", () => {
  test("trims surrounding whitespace", () => {
    expect(labelName("  bug  ")).toBe("bug")
  })

  test("accepts a name at the length limit", () => {
    expect(labelName("a".repeat(LABEL_NAME_MAX_LENGTH))).toHaveLength(LABEL_NAME_MAX_LENGTH)
  })

  test("rejects an empty or whitespace-only name", () => {
    expect(() => labelName("")).toThrow(InvalidLabelError)
    expect(() => labelName("   ")).toThrow(InvalidLabelError)
  })

  test("rejects a name past the length limit", () => {
    expect(() => labelName("a".repeat(LABEL_NAME_MAX_LENGTH + 1))).toThrow(InvalidLabelError)
  })

  test("rejects control characters, including newlines", () => {
    expect(() => labelName("bug\nfix")).toThrow(InvalidLabelError)
    expect(() => labelName("bug\tfix")).toThrow(InvalidLabelError)
  })
})

describe("label color", () => {
  test("normalizes a valid hex value to lowercase", () => {
    expect(labelColor("#D73A4A")).toBe("#d73a4a")
  })

  test("rejects shorthand, missing hashes, and named colors", () => {
    expect(() => labelColor("#d73")).toThrow(InvalidLabelError)
    expect(() => labelColor("d73a4a")).toThrow(InvalidLabelError)
    expect(() => labelColor("red")).toThrow(InvalidLabelError)
    expect(() => labelColor("#gggggg")).toThrow(InvalidLabelError)
    expect(() => labelColor("")).toThrow(InvalidLabelError)
  })
})

describe("label scope", () => {
  const team = newTeamId()
  const other = newTeamId()

  test("a null team is a workspace label", () => {
    expect(labelScope(null)).toEqual({ kind: "workspace" })
  })

  test("a team id is a team label", () => {
    expect(labelScope(team)).toEqual({ kind: "team", teamId: team })
  })

  test("workspace labels apply to every team", () => {
    const scope = labelScope(null)

    expect(labelAppliesToTeam(scope, team)).toBe(true)
    expect(labelAppliesToTeam(scope, other)).toBe(true)
  })

  test("team labels apply only to their own team", () => {
    const scope = labelScope(team)

    expect(labelAppliesToTeam(scope, team)).toBe(true)
    expect(labelAppliesToTeam(scope, other)).toBe(false)
  })
})

describe("label ids", () => {
  test("parses a label id", () => {
    const id = labelId("0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b")

    expect(String(id)).toBe("0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b")
  })

  test("rejects a raw string", () => {
    expect(() => labelId("bug")).toThrow()
  })
})
