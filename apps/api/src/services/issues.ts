import type { TenantDb } from "@workerbee/db"
import type { ActorId, Priority, TeamId } from "@workerbee/domain"

export type CreateIssueInput = {
  readonly teamId: TeamId
  readonly stateId: string
  readonly title: string
  readonly description?: string
  readonly priority?: Priority
}

export function createIssue(
  tenant: TenantDb,
  actorId: ActorId,
  input: CreateIssueInput,
) {
  return tenant.createIssue({ ...input, creatorId: actorId })
}

export function issueDetail(tenant: TenantDb, id: string) {
  return tenant.issueById(id)
}

export type IssuePatchInput = {
  readonly title?: string
  readonly description?: string
  readonly stateId?: string
  readonly priority?: Priority
}

export function updateIssue(
  tenant: TenantDb,
  id: string,
  patch: IssuePatchInput,
  actorId: ActorId,
  version: number | undefined,
) {
  return tenant.updateIssue(id, patch, actorId, version)
}

export function commentsForIssue(tenant: TenantDb, id: string) {
  return tenant.commentsForIssue(id)
}

export function addComment(
  tenant: TenantDb,
  id: string,
  body: string,
  actorId: ActorId,
) {
  return tenant.addComment(id, body, actorId)
}
