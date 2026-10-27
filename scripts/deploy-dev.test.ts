import { describe, expect, test } from "bun:test"
import { assertDeployAllowed } from "./deploy-dev"

describe("assertDeployAllowed", () => {
  test("allows CI", () => {
    expect(() => assertDeployAllowed({ CI: "true" })).not.toThrow()
  })

  test("allows break-glass", () => {
    expect(() => assertDeployAllowed({ ALLOW_LOCAL_DEPLOY: "1" })).not.toThrow()
  })

  test("refuses local", () => {
    expect(() => assertDeployAllowed({})).toThrow("run in CI")
    expect(() => assertDeployAllowed({ CI: "false" })).toThrow("run in CI")
    expect(() => assertDeployAllowed({ CI: "0" })).toThrow("run in CI")
    expect(() => assertDeployAllowed({ CI: "" })).toThrow("run in CI")
  })
})
