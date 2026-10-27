import { describe, expect, test } from "bun:test"
import { resolveRequestUrl } from "./api"

const baseUrl = "https://workerbee.example"

describe("resolveRequestUrl", () => {
  test("resolves same-origin paths", () => {
    expect(resolveRequestUrl(baseUrl, "/api/v1/protocol").href).toBe(
      "https://workerbee.example/api/v1/protocol",
    )
  })

  test("refuses an absolute cross-origin URL", () => {
    expect(() => resolveRequestUrl(baseUrl, "https://attacker.example/")).toThrow(
      "cross-origin",
    )
  })

  test("refuses a protocol-relative URL", () => {
    expect(() => resolveRequestUrl(baseUrl, "//attacker.example/")).toThrow("cross-origin")
  })
})
