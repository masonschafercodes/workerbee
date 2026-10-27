import {
  can,
  InvalidLabelError,
  issueId as toIssueId,
  labelColor,
  labelId as toLabelId,
  labelName,
  teamId as toTeamId,
  type TeamId,
} from "@workerbee/domain"
import { Hono } from "hono"
import type { AppDeps } from "../deps"
import { tenantFor } from "../http/tenant"
import {
  attachLabel,
  createLabel,
  deleteLabel,
  detachLabel,
  listLabels,
  updateLabel,
} from "../services/labels"
import { issueDetail } from "../services/issues"
import { publishCommittedChange } from "../services/publishing"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseLabelTeamId(value: unknown): TeamId | null | "invalid" {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== "string") {
    return "invalid"
  }

  try {
    return toTeamId(value)
  } catch {
    return "invalid"
  }
}

export function labelRoutes(deps: AppDeps) {
  const app = new Hono()

  app.get("/labels", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    const query = c.req.query("teamId")
    let team: TeamId | undefined

    if (query !== undefined && query !== "") {
      try {
        team = toTeamId(query)
      } catch {
        return c.json({ error: "invalid_team" }, 400)
      }
    }

    const labels = await listLabels(tenant.tenant, team)

    return c.json({ labels })
  })

  app.post("/labels", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    if (!can(tenant.principal, "label:manage")) {
      return c.json({ error: "forbidden" }, 403)
    }

    let body: unknown

    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (!isRecord(body)) {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (typeof body.name !== "string") {
      return c.json({ error: "invalid_name" }, 400)
    }

    if (typeof body.color !== "string") {
      return c.json({ error: "invalid_color" }, 400)
    }

    let name: string
    let color: string

    try {
      name = labelName(body.name)
      color = labelColor(body.color)
    } catch (error) {
      if (error instanceof InvalidLabelError) {
        return c.json({ error: "invalid_label" }, 400)
      }

      throw error
    }

    const team = parseLabelTeamId(body.teamId)

    if (team === "invalid") {
      return c.json({ error: "invalid_team" }, 400)
    }

    const created = await createLabel(tenant.tenant, tenant.principal.actorId, {
      name,
      color,
      teamId: team,
    })

    await publishCommittedChange(deps, tenant.workspaceId, created.seq)

    return c.json(created.label, 201)
  })

  app.patch("/labels/:id", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    if (!can(tenant.principal, "label:manage")) {
      return c.json({ error: "forbidden" }, 403)
    }

    let id: string

    try {
      id = toLabelId(c.req.param("id"))
    } catch {
      return c.json({ error: "not_found" }, 404)
    }

    let body: unknown

    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (!isRecord(body)) {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (body.name === undefined && body.color === undefined) {
      return c.json({ error: "empty_patch" }, 400)
    }

    let name: string | undefined
    let color: string | undefined

    try {
      if (body.name !== undefined) {
        if (typeof body.name !== "string") {
          return c.json({ error: "invalid_name" }, 400)
        }

        name = labelName(body.name)
      }

      if (body.color !== undefined) {
        if (typeof body.color !== "string") {
          return c.json({ error: "invalid_color" }, 400)
        }

        color = labelColor(body.color)
      }
    } catch (error) {
      if (error instanceof InvalidLabelError) {
        return c.json({ error: "invalid_label" }, 400)
      }

      throw error
    }

    const updated = await updateLabel(
      tenant.tenant,
      id,
      {
        ...(name !== undefined ? { name } : {}),
        ...(color !== undefined ? { color } : {}),
      },
      tenant.principal.actorId,
    )

    await publishCommittedChange(deps, tenant.workspaceId, updated.seq)

    return c.json(updated.label)
  })

  app.delete("/labels/:id", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    if (!can(tenant.principal, "label:manage")) {
      return c.json({ error: "forbidden" }, 403)
    }

    let id: string

    try {
      id = toLabelId(c.req.param("id"))
    } catch {
      return c.json({ error: "not_found" }, 404)
    }

    const deleted = await deleteLabel(tenant.tenant, id, tenant.principal.actorId)

    await publishCommittedChange(deps, tenant.workspaceId, deleted.seq)

    return c.body(null, 204)
  })

  app.post("/issues/:id/labels", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    let issue: string

    try {
      issue = toIssueId(c.req.param("id"))
    } catch {
      return c.json({ error: "not_found" }, 404)
    }

    let body: unknown

    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (!isRecord(body)) {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (typeof body.labelId !== "string") {
      return c.json({ error: "invalid_label_id" }, 400)
    }

    let label: string

    try {
      label = toLabelId(body.labelId)
    } catch {
      return c.json({ error: "invalid_label_id" }, 400)
    }

    const existing = await issueDetail(tenant.tenant, issue)

    if (existing === null) {
      return c.json({ error: "not_found" }, 404)
    }

    if (!can(tenant.principal, "issue:write", existing.teamId as TeamId)) {
      return c.json({ error: "forbidden" }, 403)
    }

    const attached = await attachLabel(
      tenant.tenant,
      issue,
      label,
      tenant.principal.actorId,
    )

    await publishCommittedChange(deps, tenant.workspaceId, attached.seq)

    return c.body(null, 204)
  })

  app.delete("/issues/:id/labels/:labelId", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    let issue: string

    try {
      issue = toIssueId(c.req.param("id"))
    } catch {
      return c.json({ error: "not_found" }, 404)
    }

    let label: string

    try {
      label = toLabelId(c.req.param("labelId"))
    } catch {
      return c.json({ error: "not_found" }, 404)
    }

    const existing = await issueDetail(tenant.tenant, issue)

    if (existing === null) {
      return c.json({ error: "not_found" }, 404)
    }

    if (!can(tenant.principal, "issue:write", existing.teamId as TeamId)) {
      return c.json({ error: "forbidden" }, 403)
    }

    const detached = await detachLabel(
      tenant.tenant,
      issue,
      label,
      tenant.principal.actorId,
    )

    await publishCommittedChange(deps, tenant.workspaceId, detached.seq)

    return c.body(null, 204)
  })

  return app
}
