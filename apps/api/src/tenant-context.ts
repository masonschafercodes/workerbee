import type { Auth } from "@workerbee/auth"
import { findMembership, TenantDb, type Database } from "@workerbee/db"
import { actorId, type UserPrincipal, type WorkspaceId, type WorkspaceRole } from "@workerbee/domain"

export type TenantContext = {
  readonly tenant: TenantDb
  readonly principal: UserPrincipal
  readonly workspaceId: WorkspaceId
  readonly role: WorkspaceRole
}

export type TenantResolution =
  | { readonly ok: true; readonly context: TenantContext }
  | {
      readonly ok: false
      readonly status: 400 | 401 | 404
      readonly error: string
    }

/**
 * Resolves the workspace from the x-workerbee-workspace header, then checks
 * membership. A workspace the caller does not belong to looks the same as one
 * that does not exist.
 */
export async function resolveTenant(
  auth: Auth,
  db: Database,
  headers: Headers,
): Promise<TenantResolution> {
  const session = await auth.api.getSession({ headers })

  if (session === null) {
    return { ok: false, status: 401, error: "unauthorized" }
  }

  const slug = headers.get("x-workerbee-workspace")?.trim()

  if (slug === undefined || slug === "") {
    return { ok: false, status: 400, error: "workspace_header_required" }
  }

  const membership = await findMembership(db, slug, session.user.id)

  if (membership === null) {
    return { ok: false, status: 404, error: "workspace_not_found" }
  }

  const principal: UserPrincipal = {
    kind: "user",
    actorId: actorId(session.user.id),
    role: membership.role,
    teamIds: "all",
  }

  return {
    ok: true,
    context: {
      tenant: new TenantDb(db, membership.workspaceId),
      principal,
      workspaceId: membership.workspaceId,
      role: membership.role,
    },
  }
}
