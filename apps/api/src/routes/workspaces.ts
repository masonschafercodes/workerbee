import { workspaceSlug } from "@workerbee/domain"
import { Hono } from "hono"
import type { AppDeps } from "../deps"
import { sessionUser } from "../http/session"
import { createWorkspace, listWorkspaces } from "../services/workspaces"

export function workspaceRoutes(deps: AppDeps) {
  const app = new Hono()

  app.get("/workspaces", async (c) => {
    const user = await sessionUser(c, deps)

    if (user instanceof Response) {
      return user
    }

    return c.json({ workspaces: await listWorkspaces(deps.db, user.id) })
  })

  app.post("/workspaces", async (c) => {
    const user = await sessionUser(c, deps)

    if (user instanceof Response) {
      return user
    }

    let body: { name?: unknown; slug?: unknown }

    try {
      body = (await c.req.json()) as typeof body
    } catch {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (typeof body.name !== "string" || body.name.trim() === "") {
      return c.json({ error: "invalid_name" }, 400)
    }

    let slug

    try {
      slug = workspaceSlug(String(body.slug ?? ""))
    } catch {
      return c.json({ error: "invalid_slug" }, 400)
    }

    const workspace = await createWorkspace({
      auth: deps.auth,
      db: deps.db,
      userId: user.id,
      name: body.name.trim(),
      slug,
      headers: c.req.raw.headers,
    })

    return c.json(workspace)
  })

  return app
}
