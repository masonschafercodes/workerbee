import type { MiddlewareHandler } from "hono"

/**
 * Better Auth checks the origin on its own routes. Cookie-authenticated API
 * mutations need the same check, so a cross-site form post cannot act.
 */
export function originGuard(origin: string): MiddlewareHandler {
  return async (c, next) => {
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(c.req.method)
    const requestOrigin = c.req.header("origin")

    if (unsafe && requestOrigin !== undefined && requestOrigin !== origin) {
      return c.json({ error: "bad_origin" }, 403)
    }

    await next()
  }
}
