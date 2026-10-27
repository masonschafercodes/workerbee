import { describe, expect, test } from "bun:test"
import { parseEnvFile } from "./env"

describe("parseEnvFile", () => {
  test("parses bare, quoted, exported, and commented values", () => {
    const values = parseEnvFile(
      [
        "# comment",
        "",
        "DATABASE_URL=postgres://localhost/workerbee",
        "DOUBLE=\"value with spaces\"",
        "SINGLE='single quoted'",
        "export EXPORTED=yes",
        "TRAILING=value # note",
        "QUOTED_TRAILING=\"secret value\" # note",
        "HASH=abc#def",
        "EMPTY=",
        "not an assignment",
      ].join("\n"),
    )

    expect(values).toEqual({
      DATABASE_URL: "postgres://localhost/workerbee",
      DOUBLE: "value with spaces",
      SINGLE: "single quoted",
      EXPORTED: "yes",
      TRAILING: "value",
      QUOTED_TRAILING: "secret value",
      HASH: "abc#def",
      EMPTY: "",
    })
  })

  test("handles CRLF line endings", () => {
    expect(parseEnvFile("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" })
  })
})
