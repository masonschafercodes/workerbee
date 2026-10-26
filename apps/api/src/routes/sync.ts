import { Hono } from "hono"
import type { AppDeps } from "../deps"
import { tenantFor } from "../http/tenant"
import { parseNumber } from "../http/validation"
import { bootstrap, changes } from "../services/sync"

export function syncRoutes(deps: AppDeps) {
  const app = new Hono()

  app.get("/bootstrap", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    return c.json(await bootstrap(tenant.tenant, tenant.principal))
  })

  app.get("/sync", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    const since = parseNumber(c.req.query("since"), 0)
    const requestedLimit = parseNumber(c.req.query("limit"), 100)

    if (since === null || requestedLimit === null || requestedLimit === 0) {
      return c.json({ error: "invalid_cursor" }, 400)
    }

    const visible = await changes(
      tenant.tenant,
      tenant.principal,
      since,
      requestedLimit,
    )

    return c.json({ changesets: visible })
  })

  return app
}
