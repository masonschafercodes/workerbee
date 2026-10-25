import type { WorkspaceId, WorkspaceSlug } from "./ids"

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export type Workspace = {
  readonly id: WorkspaceId
  readonly slug: WorkspaceSlug
  readonly name: string
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export class InvalidWorkspaceSlugError extends Error {
  constructor(value: string) {
    super(`Invalid workspace slug: ${JSON.stringify(value)}`)
    this.name = "InvalidWorkspaceSlugError"
  }
}

export function workspaceSlug(value: string): WorkspaceSlug {
  const normalized = value.trim().toLowerCase()

  if (!SLUG_PATTERN.test(normalized)) {
    throw new InvalidWorkspaceSlugError(value)
  }

  return normalized as WorkspaceSlug
}
