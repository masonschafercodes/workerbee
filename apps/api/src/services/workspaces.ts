import type { Auth } from "@workerbee/auth"
import {
  findMembership,
  findWorkspaceBySlug,
  listMemberships,
  TenantDb,
  type Database,
  type TeamStateInput,
} from "@workerbee/db"
import {
  actorId,
  workspaceId as toWorkspaceId,
  type WorkspaceSlug,
} from "@workerbee/domain"

const DEFAULT_TEAM_STATES: readonly TeamStateInput[] = [
  { name: "Backlog", category: "backlog", position: 0 },
  { name: "Todo", category: "unstarted", position: 1 },
  { name: "In Progress", category: "started", position: 2 },
  { name: "Done", category: "done", position: 3 },
  { name: "Canceled", category: "canceled", position: 4 },
]

export class WorkspaceExistsError extends Error {
  constructor() {
    super("workspace exists")
    this.name = "WorkspaceExistsError"
  }
}

export type WorkspaceRecord = {
  readonly id: string
  readonly slug: string
  readonly name: string
}

export function listWorkspaces(db: Database, userId: string) {
  return listMemberships(db, userId)
}

async function provisionDefaultTeam(tenant: TenantDb, userId: string) {
  await tenant.ensureTeam({
    key: "ENG",
    name: "Engineering",
    actorId: actorId(userId),
    states: DEFAULT_TEAM_STATES,
  })
}

export type CreateWorkspaceInput = {
  readonly auth: Auth
  readonly db: Database
  readonly userId: string
  readonly name: string
  readonly slug: WorkspaceSlug
  readonly headers: Headers
}

/**
 * Creates a workspace and provisions its default team. If a previous attempt
 * created the workspace but failed during provisioning, an owner or admin who
 * retries the same slug completes it instead of getting a conflict.
 */
export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<WorkspaceRecord> {
  const existing = await findWorkspaceBySlug(input.db, input.slug)

  if (existing !== null) {
    const membership = await findMembership(input.db, input.slug, input.userId)

    if (
      membership === null ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new WorkspaceExistsError()
    }

    const tenant = new TenantDb(input.db, membership.workspaceId)

    await provisionDefaultTeam(tenant, input.userId)

    return existing
  }

  const organization = await input.auth.api.createOrganization({
    body: { name: input.name, slug: input.slug },
    headers: input.headers,
  })

  const tenant = new TenantDb(input.db, toWorkspaceId(organization.id))

  await provisionDefaultTeam(tenant, input.userId)

  return organization
}
