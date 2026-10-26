import { MAX_CHANGES_PER_CHANGESET } from "@workerbee/sync"
import { Hono } from "hono"
import { MAX_SYNC_LIMIT } from "../services/sync"

/**
 * Bumped when the wire shape of /sync or the agent tools changes in a way that
 * old clients cannot read. Clients send the version they speak.
 */
export const PROTOCOL_VERSION = 1

export function protocolRoutes() {
  const app = new Hono()

  app.get("/health", (c) => c.json({ ok: true, service: "workerbee-api" }))

  app.get("/api/v1/protocol", (c) =>
    c.json({
      protocol: PROTOCOL_VERSION,
      minClient: PROTOCOL_VERSION,
      idScheme: "uuidv7",
      sync: {
        maxChangesPerChangeset: MAX_CHANGES_PER_CHANGESET,
        maxSyncLimit: MAX_SYNC_LIMIT,
      },
    }),
  )

  return app
}
