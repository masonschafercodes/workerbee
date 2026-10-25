import type { Auth } from "@workerbee/auth"
import {
  ConflictError,
  NotFoundError,
  type Database,
} from "@workerbee/db"
import {
  PRIORITIES,
  stateId as toStateId,
  teamId as toTeamId,
  workspaceSlug,
  type Priority,
} from "@workerbee/domain"
import { MAX_CHANGES_PER_CHANGESET, visibleChanges } from "@workerbee/sync"
import { Hono } from "hono"
import { resolveTenant } from "./tenant-context"

/**
 * Bumped when the wire shape of /sync or the agent tools changes in a way that
 * old clients cannot read. Clients send the version they speak.
 */
export const PROTOCOL_VERSION = 1

const MAX_SYNC_LIMIT = 500

export type AppDeps = {
  readonly auth: Auth
  readonly db: Database
  readonly origin: string
}

function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value)
}

function parseNumber(value: string | undefined, fallback: number): number | null {
  if (value === undefined || value === "") {
    return fallback
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export function createApp({ auth, db, origin }: AppDeps) {
  const app = new Hono()

  // Better Auth checks the origin on its own routes. Our cookie-authenticated
  // mutations need the same check, so a cross-site form post cannot act.
  app.use("/api/v1/*", async (c, next) => {
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(c.req.method)
    const requestOrigin = c.req.header("origin")

    if (unsafe && requestOrigin !== undefined && requestOrigin !== origin) {
      return c.json({ error: "bad_origin" }, 403)
    }

    await next()
  })

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

  // Better Auth's organization routes skip the domain slug rule, so the product
  // endpoints below are the only way to create or rename a workspace.
  app.post("/api/auth/organization/create", (c) =>
    c.json({ error: "use_workspaces_endpoint" }, 404),
  )
  app.post("/api/auth/organization/update", (c) =>
    c.json({ error: "use_workspaces_endpoint" }, 404),
  )

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))

  /**
   * Workspace creation validates the slug before it reaches Better Auth.
   */
  app.post("/api/v1/workspaces", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (session === null) {
      return c.json({ error: "unauthorized" }, 401)
    }

    let body: { name?: unknown; slug?: unknown }

    try {
      body = (await c.req.json()) as { name?: unknown; slug?: unknown }
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

    const organization = await auth.api.createOrganization({
      body: { name: body.name.trim(), slug },
      headers: c.req.raw.headers,
    })

    return c.json(organization)
  })

  app.get("/api/v1/bootstrap", async (c) => {
    const resolved = await resolveTenant(auth, db, c.req.raw.headers)

    if (!resolved.ok) {
      return c.json({ error: resolved.error }, resolved.status)
    }

    const snapshot = await resolved.context.tenant.bootstrap()

    return c.json({
      ...snapshot,
      actor: {
        id: resolved.context.principal.actorId,
        kind: resolved.context.principal.kind,
      },
      teamScope: resolved.context.principal.teamIds,
    })
  })

  app.get("/api/v1/sync", async (c) => {
    const resolved = await resolveTenant(auth, db, c.req.raw.headers)

    if (!resolved.ok) {
      return c.json({ error: resolved.error }, resolved.status)
    }

    const since = parseNumber(c.req.query("since"), 0)
    const requestedLimit = parseNumber(c.req.query("limit"), 100)

    if (since === null || requestedLimit === null || requestedLimit === 0) {
      return c.json({ error: "invalid_cursor" }, 400)
    }

    const changesets = await resolved.context.tenant.changesSince(
      since,
      Math.min(requestedLimit, MAX_SYNC_LIMIT),
    )

    const visible = changesets
      .map((changeset) => visibleChanges(changeset, resolved.context.principal.teamIds))
      .filter((changeset) => changeset !== null)

    return c.json({ changesets: visible })
  })

  app.post("/api/v1/issues", async (c) => {
    const resolved = await resolveTenant(auth, db, c.req.raw.headers)

    if (!resolved.ok) {
      return c.json({ error: resolved.error }, resolved.status)
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

    const created = await resolved.context.tenant.createIssue({
      teamId: team,
      stateId: state,
      title: body.title.trim(),
      creatorId: resolved.context.principal.actorId,
      ...(typeof body.description === "string"
        ? { description: body.description }
        : {}),
      ...(priority !== undefined ? { priority } : {}),
    })

    return c.json(created, 201)
  })

  app.get("/api/v1/issues/:id/comments", async (c) => {
    const resolved = await resolveTenant(auth, db, c.req.raw.headers)

    if (!resolved.ok) {
      return c.json({ error: resolved.error }, resolved.status)
    }

    const comments = await resolved.context.tenant.commentsForIssue(c.req.param("id"))

    return c.json({ comments })
  })

  app.post("/api/v1/issues/:id/comments", async (c) => {
    const resolved = await resolveTenant(auth, db, c.req.raw.headers)

    if (!resolved.ok) {
      return c.json({ error: resolved.error }, resolved.status)
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

    const created = await resolved.context.tenant.addComment(
      c.req.param("id"),
      body.body.trim(),
      resolved.context.principal.actorId,
    )

    return c.json(created, 201)
  })

  app.notFound((c) => c.json({ error: "not_found" }, 404))

  app.onError((error, c) => {
    if (error instanceof NotFoundError) {
      return c.json({ error: "not_found" }, 404)
    }

    if (error instanceof ConflictError) {
      return c.json({ error: "conflict" }, 409)
    }

    console.error(error)
    return c.json({ error: "internal" }, 500)
  })

  return app
}
