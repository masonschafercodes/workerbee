import { Hono } from "hono"
import type { AppDeps } from "../deps"

export function authRoutes(deps: AppDeps) {
  const app = new Hono()

  // Better Auth's organization routes skip the domain slug rule, so the product
  // endpoint in workspaceRoutes is the only way to create a workspace.
  app.post("/organization/create", (c) =>
    c.json({ error: "use_workspaces_endpoint" }, 404),
  )
  app.post("/organization/update", (c) =>
    c.json({ error: "use_workspaces_endpoint" }, 404),
  )

  app.on(["GET", "POST"], "/*", (c) => deps.auth.handler(c.req.raw))

  return app
}
