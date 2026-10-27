import type { TenantDb } from "@workerbee/db"
import type { ActorId, TeamId } from "@workerbee/domain"

export type CreateLabelInput = {
  readonly name: string
  readonly color: string
  readonly teamId: TeamId | null
}

export type UpdateLabelInput = {
  readonly name?: string
  readonly color?: string
}

export function listLabels(tenant: TenantDb, teamId?: TeamId) {
  return tenant.listLabels(teamId)
}

export function createLabel(
  tenant: TenantDb,
  actorId: ActorId,
  input: CreateLabelInput,
) {
  return tenant.createLabel({ ...input, actorId })
}

export function updateLabel(
  tenant: TenantDb,
  id: string,
  patch: UpdateLabelInput,
  actorId: ActorId,
) {
  return tenant.updateLabel(id, patch, actorId)
}

export function deleteLabel(tenant: TenantDb, id: string, actorId: ActorId) {
  return tenant.deleteLabel(id, actorId)
}

export function attachLabel(
  tenant: TenantDb,
  issueId: string,
  labelId: string,
  actorId: ActorId,
) {
  return tenant.attachLabel(issueId, labelId, actorId)
}

export function detachLabel(
  tenant: TenantDb,
  issueId: string,
  labelId: string,
  actorId: ActorId,
) {
  return tenant.detachLabel(issueId, labelId, actorId)
}
