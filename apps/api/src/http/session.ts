import type { Context } from "hono"
import type { AppDeps } from "../deps"

export type SessionUser = {
  readonly id: string
}

export async function sessionUser(
  c: Context,
  deps: AppDeps,
): Promise<SessionUser | Response> {
  const session = await deps.auth.api.getSession({ headers: c.req.raw.headers })

  if (session === null) {
    return c.json({ error: "unauthorized" }, 401)
  }

  return { id: session.user.id }
}
