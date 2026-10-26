import { ConflictError, NotFoundError } from "@workerbee/db"
import type { Context } from "hono"
import { WorkspaceExistsError } from "../services/workspaces"

export function handleError(error: Error, c: Context) {
  if (error instanceof NotFoundError) {
    return c.json({ error: "not_found" }, 404)
  }

  if (error instanceof WorkspaceExistsError) {
    return c.json({ error: "workspace_exists" }, 409)
  }

  if (error instanceof ConflictError) {
    return c.json({ error: "conflict" }, 409)
  }

  console.error(error)
  return c.json({ error: "internal" }, 500)
}
