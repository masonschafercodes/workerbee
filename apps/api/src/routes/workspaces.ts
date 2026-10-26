import { workspaceId as toWorkspaceId, workspaceSlug } from "@workerbee/domain"
import { Hono } from "hono"
import type { AppDeps } from "../deps"
import { sessionUser } from "../http/session"
import { publishCommittedChange } from "../services/publishing"
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

    const created = await createWorkspace({
      auth: deps.auth,
      db: deps.db,
      userId: user.id,
      name: body.name.trim(),
      slug,
      headers: c.req.raw.headers,
    })

    await publishCommittedChange(deps, toWorkspaceId(created.workspace.id), created.seq)

    return c.json(created.workspace)
  })

  return app
}
