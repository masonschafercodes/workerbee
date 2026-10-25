import { describe, expect, test } from "bun:test"
import type { Auth } from "@workerbee/auth"
import type { Database } from "@workerbee/db"
import { createApp, PROTOCOL_VERSION } from "./app"

const app = createApp({
  auth: {
    handler: async () => new Response(null, { status: 501 }),
  } as unknown as Auth,
  db: {} as unknown as Database,
  origin: "http://localhost:3001",
})

describe("health", () => {
  test("reports ok", async () => {
    const response = await app.request("/health")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, service: "workerbee-api" })
  })
})

describe("protocol", () => {
  test("advertises the current protocol version", async () => {
    const response = await app.request("/api/v1/protocol")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      protocol: PROTOCOL_VERSION,
      minClient: PROTOCOL_VERSION,
      idScheme: "uuidv7",
      sync: { maxChangesPerChangeset: 500, maxSyncLimit: 500 },
    })
  })
})

describe("origin check", () => {
  test("rejects a mutation from a foreign origin", async () => {
    const response = await app.request("http://localhost:3001/api/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ name: "X", slug: "x" }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "bad_origin" })
  })
})

describe("unknown routes", () => {
  test("return json 404 instead of an html page", async () => {
    const response = await app.request("/api/v1/nope")

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "not_found" })
  })
})
