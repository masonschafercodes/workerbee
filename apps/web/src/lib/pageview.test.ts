import { describe, expect, test } from "bun:test"
import { pageviewUrl } from "./pageview"

describe("pageview URLs", () => {
  test("drops the query string and hash", () => {
    expect(
      pageviewUrl("/w/eng/issues/ENG-1?q=secret+search#comment", "https://workerbee.example"),
    ).toBe("https://workerbee.example/w/eng/issues/ENG-1")
  })

  test("keeps the path for the root route", () => {
    expect(pageviewUrl("/", "https://workerbee.example")).toBe("https://workerbee.example/")
  })
})
