import type { Context } from "hono"
import type { AppDeps } from "../deps"
import { resolveTenant, type TenantContext } from "../tenant-context"

export async function tenantFor(
  c: Context,
  deps: AppDeps,
): Promise<TenantContext | Response> {
  const resolved = await resolveTenant(deps.auth, deps.db, c.req.raw.headers)

  if (!resolved.ok) {
    return c.json({ error: resolved.error }, resolved.status)
  }

  return resolved.context
}
