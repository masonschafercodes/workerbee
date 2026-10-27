import { ConflictError, NotFoundError } from "@workerbee/db"
import { InvalidLabelError } from "@workerbee/domain"
import type { Telemetry } from "@workerbee/telemetry"
import type { Context } from "hono"
import { WorkspaceExistsError } from "../services/workspaces"

export function handleError(error: Error, c: Context, telemetry: Telemetry) {
  if (error instanceof NotFoundError) {
    return c.json({ error: "not_found" }, 404)
  }

  if (error instanceof InvalidLabelError) {
    return c.json({ error: "invalid_label" }, 400)
  }

  if (error instanceof WorkspaceExistsError) {
    return c.json({ error: "workspace_exists" }, 409)
  }

  if (error instanceof ConflictError) {
    return c.json({ error: "conflict" }, 409)
  }

  console.error(error)
  telemetry.captureException(error, undefined, {
    path: c.req.path,
    method: c.req.method,
  })
  telemetry.log("error", error.message, { path: c.req.path, method: c.req.method })

  return c.json({ error: "internal" }, 500)
}
