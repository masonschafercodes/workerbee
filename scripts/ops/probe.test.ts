import { describe, expect, test } from "bun:test"
import { fetchSameOrigin, isSourceMapBody } from "./probe"

describe("isSourceMapBody", () => {
  test("detects a source map regardless of whitespace", () => {
    expect(
      isSourceMapBody(JSON.stringify({ version: 3, sources: ["a.ts"], mappings: "AAAA" })),
    ).toBe(true)
    expect(isSourceMapBody('{"version": 3, "sources": [], "mappings": ""}')).toBe(true)
  })

  test("detects an indexed source map", () => {
    expect(
      isSourceMapBody(
        JSON.stringify({ version: 3, sections: [{ offset: { line: 0, column: 0 } }] }),
      ),
    ).toBe(true)
  })

  test("refuses a cross-origin fetch without a request", async () => {
    await expect(
      fetchSameOrigin(new URL("https://attacker.example/x"), new URL("https://workerbee.example")),
    ).rejects.toThrow("cross-origin")
  })

  test("ignores the SPA fallback and ordinary JSON", () => {
    expect(isSourceMapBody("<!doctype html><html></html>")).toBe(false)
    expect(isSourceMapBody(JSON.stringify({ version: 1 }))).toBe(false)
    expect(isSourceMapBody("not json")).toBe(false)
  })
})
