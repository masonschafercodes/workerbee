import {
  stateId as toStateId,
  teamId as toTeamId,
  type Priority,
} from "@workerbee/domain"
import { Hono } from "hono"
import type { AppDeps } from "../deps"
import { tenantFor } from "../http/tenant"
import { isPriority } from "../http/validation"
import {
  addComment,
  commentsForIssue,
  createIssue,
  issueDetail,
  updateIssue,
} from "../services/issues"

export function issueRoutes(deps: AppDeps) {
  const app = new Hono()

  app.post("/issues", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    let body: {
      teamId?: unknown
      stateId?: unknown
      title?: unknown
      description?: unknown
      priority?: unknown
    }

    try {
      body = (await c.req.json()) as typeof body
    } catch {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (typeof body.title !== "string" || body.title.trim() === "") {
      return c.json({ error: "invalid_title" }, 400)
    }

    if (typeof body.description !== "string" && body.description !== undefined) {
      return c.json({ error: "invalid_description" }, 400)
    }

    if (body.priority !== undefined && !isPriority(body.priority)) {
      return c.json({ error: "invalid_priority" }, 400)
    }

    let team
    let state

    try {
      team = toTeamId(String(body.teamId ?? ""))
      state = toStateId(String(body.stateId ?? ""))
    } catch {
      return c.json({ error: "invalid_team_or_state" }, 400)
    }

    const priority = isPriority(body.priority) ? body.priority : undefined

    const created = await createIssue(tenant.tenant, tenant.principal.actorId, {
      teamId: team,
      stateId: state,
      title: body.title.trim(),
      ...(typeof body.description === "string"
        ? { description: body.description }
        : {}),
      ...(priority !== undefined ? { priority } : {}),
    })

    return c.json(created, 201)
  })

  app.get("/issues/:id", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    const issue = await issueDetail(tenant.tenant, c.req.param("id"))

    if (issue === null) {
      return c.json({ error: "not_found" }, 404)
    }

    return c.json({ issue })
  })

  app.patch("/issues/:id", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    let body: {
      title?: unknown
      description?: unknown
      stateId?: unknown
      priority?: unknown
      version?: unknown
    }

    try {
      body = (await c.req.json()) as typeof body
    } catch {
      return c.json({ error: "invalid_json" }, 400)
    }

    let title: string | undefined
    let description: string | undefined
    let state: string | undefined
    let priority: Priority | undefined
    let version: number | undefined

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.trim() === "") {
        return c.json({ error: "invalid_title" }, 400)
      }

      title = body.title.trim()
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string") {
        return c.json({ error: "invalid_description" }, 400)
      }

      description = body.description
    }

    if (body.stateId !== undefined) {
      try {
        state = toStateId(String(body.stateId))
      } catch {
        return c.json({ error: "invalid_state" }, 400)
      }
    }

    if (body.priority !== undefined) {
      if (!isPriority(body.priority)) {
        return c.json({ error: "invalid_priority" }, 400)
      }

      priority = body.priority
    }

    if (body.version !== undefined) {
      if (
        typeof body.version !== "number" ||
        !Number.isInteger(body.version) ||
        body.version < 1
      ) {
        return c.json({ error: "invalid_version" }, 400)
      }

      version = body.version
    }

    const updated = await updateIssue(
      tenant.tenant,
      c.req.param("id"),
      {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(state !== undefined ? { stateId: state } : {}),
        ...(priority !== undefined ? { priority } : {}),
      },
      tenant.principal.actorId,
      version,
    )

    return c.json(updated)
  })

  app.get("/issues/:id/comments", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    const comments = await commentsForIssue(tenant.tenant, c.req.param("id"))

    return c.json({ comments })
  })

  app.post("/issues/:id/comments", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    let body: { body?: unknown }

    try {
      body = (await c.req.json()) as typeof body
    } catch {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (typeof body.body !== "string" || body.body.trim() === "") {
      return c.json({ error: "invalid_body" }, 400)
    }

    const created = await addComment(
      tenant.tenant,
      c.req.param("id"),
      body.body.trim(),
      tenant.principal.actorId,
    )

    return c.json(created, 201)
  })

  return app
}
