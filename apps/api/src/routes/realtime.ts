import { workspaceId } from "@workerbee/domain"
import { signRealtimeTicket, verifyRealtimeTicket } from "@workerbee/realtime"
import { Hono } from "hono"
import type { AppDeps } from "../deps"
import { tenantFor } from "../http/tenant"
import { parseNumber } from "../http/validation"

const TICKET_LIFETIME_MS = 60_000

export function realtimeRoutes(deps: AppDeps) {
  const app = new Hono()

  app.post("/realtime-ticket", async (c) => {
    const tenant = await tenantFor(c, deps)

    if (tenant instanceof Response) {
      return tenant
    }

    const now = Date.now()
    const ticket = await signRealtimeTicket(
      {
        workspaceId: tenant.workspaceId,
        actorId: tenant.principal.actorId,
        teamIds: tenant.principal.teamIds,
      },
      deps.realtime.secret,
      now,
      TICKET_LIFETIME_MS,
    )

    return c.json({ ticket, expiresAt: now + TICKET_LIFETIME_MS })
  })

  app.get("/realtime/:workspaceId", async (c) => {
    let wid

    try {
      wid = workspaceId(c.req.param("workspaceId"))
    } catch {
      return c.json({ error: "invalid_workspace" }, 400)
    }

    const ticket = c.req.query("ticket")
    const since = parseNumber(c.req.query("since"), 0)

    if (ticket === undefined || ticket === "" || since === null || since < 0) {
      return c.json({ error: "invalid_realtime_request" }, 400)
    }

    const verified = await verifyRealtimeTicket(ticket, deps.realtime.secret, wid)

    if (verified === null) {
      return c.json({ error: "unauthorized" }, 401)
    }

    return deps.realtime.hub.connect({
      workspaceId: wid,
      ticket,
      since,
      request: c.req.raw,
    })
  })

  return app
}
