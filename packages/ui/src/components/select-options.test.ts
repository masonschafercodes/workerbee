import { describe, expect, test } from "bun:test"
import { assertSelectOptions } from "./select-options"

describe("select options", () => {
  test("accepts unique, non-empty values", () => {
    expect(() =>
      assertSelectOptions([
        { value: "backlog", label: "Backlog" },
        { value: "unstarted", label: "Todo" },
      ]),
    ).not.toThrow()
  })

  test("rejects an empty value", () => {
    expect(() => assertSelectOptions([{ value: "", label: "None" }])).toThrow(
      "must not be empty",
    )
  })

  test("rejects duplicate values", () => {
    expect(() =>
      assertSelectOptions([
        { value: "todo", label: "Todo" },
        { value: "todo", label: "Again" },
      ]),
    ).toThrow("Duplicate")
  })
})
