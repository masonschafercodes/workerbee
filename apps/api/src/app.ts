import type { Auth } from "@workerbee/auth"
import { workspaceSlug } from "@workerbee/domain"
import { MAX_CHANGES_PER_CHANGESET } from "@workerbee/sync"
import { Hono } from "hono"

/**
 * Bumped when the wire shape of /sync or the agent tools changes in a way that
 * old clients cannot read. Clients send the version they speak.
 */
export const PROTOCOL_VERSION = 1

export type AppDeps = {
  readonly auth: Auth
  readonly origin: string
}

export function createApp({ auth, origin }: AppDeps) {
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

  app.notFound((c) => c.json({ error: "not_found" }, 404))

  return app
}
