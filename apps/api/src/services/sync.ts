import type { TenantDb } from "@workerbee/db"
import type { Principal } from "@workerbee/domain"
import { visibleChanges } from "@workerbee/sync"

export const MAX_SYNC_LIMIT = 500

export async function bootstrap(tenant: TenantDb, principal: Principal) {
  const snapshot = await tenant.bootstrap()

  return {
    ...snapshot,
    actor: {
      id: principal.actorId,
      kind: principal.kind,
    },
    teamScope: principal.teamIds,
  }
}

export async function changes(
  tenant: TenantDb,
  principal: Principal,
  since: number,
  limit: number,
) {
  const changesets = await tenant.changesSince(since, Math.min(limit, MAX_SYNC_LIMIT))

  return changesets.flatMap((changeset) => {
    const visible = visibleChanges(changeset, principal.teamIds)

    return visible === null ? [] : [visible]
  })
}
