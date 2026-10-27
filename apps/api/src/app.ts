import { Hono } from "hono"
import type { AppDeps } from "./deps"
import { handleError } from "./http/errors"
import { originGuard } from "./http/origin"
import { authRoutes } from "./routes/auth"
import { issueRoutes } from "./routes/issues"
import { labelRoutes } from "./routes/labels"
import { protocolRoutes } from "./routes/protocol"
import { realtimeRoutes } from "./routes/realtime"
import { syncRoutes } from "./routes/sync"
import { workspaceRoutes } from "./routes/workspaces"

export type { AppDeps } from "./deps"
export { PROTOCOL_VERSION } from "./routes/protocol"

export function createApp(deps: AppDeps) {
  const app = new Hono()

  app.use("/api/v1/*", originGuard(deps.origin))

  app.route("/", protocolRoutes())
  app.route("/api/auth", authRoutes(deps))
  app.route("/api/v1", workspaceRoutes(deps))
  app.route("/api/v1", issueRoutes(deps))
  app.route("/api/v1", labelRoutes(deps))
  app.route("/api/v1", syncRoutes(deps))
  app.route("/api/v1", realtimeRoutes(deps))

  app.notFound((c) => c.json({ error: "not_found" }, 404))
  app.onError((error, c) => handleError(error, c, deps.telemetry))

  return app
}
