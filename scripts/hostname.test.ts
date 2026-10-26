import { describe, expect, test } from "bun:test"
import { normalizeHostname, normalizeHostnameFromState } from "./hostname"

describe("deployment hostname", () => {
  test("keeps a bare hostname unchanged", () => {
    expect(normalizeHostname("workerbee.example.com")).toBe("workerbee.example.com")
  })

  test("keeps an empty state hostname empty before the first domain is attached", () => {
    expect(normalizeHostnameFromState("")).toBe("")
  })

  test("normalizes an existing state URL regardless of scheme casing", () => {
    expect(normalizeHostnameFromState("HTTPS://workerbee.example.com/")).toBe(
      "workerbee.example.com",
    )
  })

  test("requires deployment input to be a bare hostname", () => {
    expect(() => normalizeHostname("https://workerbee.example.com")).toThrow(
      "bare hostname",
    )
  })

  test("rejects malformed DNS labels in bare names and state URLs", () => {
    expect(() => normalizeHostname("workerbee..example.com")).toThrow("valid DNS labels")
    expect(() => normalizeHostname("-workerbee.example.com")).toThrow("valid DNS labels")
    expect(() => normalizeHostnameFromState("https://workerbee.-example.com")).toThrow(
      "valid DNS labels",
    )
  })

  test("rejects URL credentials and ports in state", () => {
    expect(() => normalizeHostnameFromState("https://user:pass@workerbee.example.com")).toThrow()
    expect(() => normalizeHostnameFromState("https://@workerbee.example.com")).toThrow()
    expect(() => normalizeHostnameFromState("https://workerbee.example.com:8443")).toThrow()
  })

  test("rejects URL paths in state", () => {
    expect(() => normalizeHostnameFromState("https://workerbee.example.com/app")).toThrow(
      "WORKERBEE_HOSTNAME URLs cannot include credentials, ports, or paths",
    )
  })
})
