import type { ActorId, TeamId } from "./ids"
import type { WorkspaceRole } from "./workspace"

export const ACTIONS = [
  "workspace:manage",
  "member:manage",
  "team:manage",
  "issue:read",
  "issue:write",
  "issue:comment",
  "agent:manage",
] as const

export type Action = (typeof ACTIONS)[number]

const TEAM_SCOPED: ReadonlySet<Action> = new Set<Action>([
  "team:manage",
  "issue:read",
  "issue:write",
  "issue:comment",
])

const ROLE_ACTIONS: Readonly<Record<WorkspaceRole, readonly Action[]>> = {
  owner: ACTIONS,
  admin: [
    "member:manage",
    "team:manage",
    "issue:read",
    "issue:write",
    "issue:comment",
    "agent:manage",
  ],
  member: ["issue:read", "issue:write", "issue:comment"],
}

type PrincipalBase = {
  readonly actorId: ActorId
  readonly role: WorkspaceRole | null
  readonly teamIds: readonly TeamId[] | "all"
}

/**
 * A human inherits the actions of their workspace role. An agent has an explicit
 * grant, and the grant can only narrow the role. `scopes` is required for an
 * agent, so an agent without a grant cannot be expressed.
 */
export type UserPrincipal = PrincipalBase & {
  readonly kind: "user"
}

export type AgentPrincipal = PrincipalBase & {
  readonly kind: "agent"
  readonly scopes: readonly Action[]
}

export type Principal = UserPrincipal | AgentPrincipal

export function isTeamScoped(action: Action): boolean {
  return TEAM_SCOPED.has(action)
}

export function actionsFor(principal: Principal): readonly Action[] {
  if (principal.role === null) {
    return []
  }

  const roleActions = ROLE_ACTIONS[principal.role]

  if (principal.kind === "user") {
    return roleActions
  }

  return principal.scopes.filter((action) => roleActions.includes(action))
}

export function can(principal: Principal, action: Action, team?: TeamId): boolean {
  if (principal.role === null) {
    return false
  }

  if (!actionsFor(principal).includes(action)) {
    return false
  }

  if (!isTeamScoped(action)) {
    return true
  }

  if (team === undefined) {
    return false
  }

  return principal.teamIds === "all" || principal.teamIds.includes(team)
}
