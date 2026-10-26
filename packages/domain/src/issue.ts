import type {
  ActorId,
  CycleId,
  IssueId,
  IssueIdentifier,
  ProjectId,
  StateId,
  TeamId,
  WorkspaceId,
} from "./ids"

export const PRIORITIES = ["none", "urgent", "high", "medium", "low"] as const
export type Priority = (typeof PRIORITIES)[number]

export const STATE_CATEGORIES = [
  "backlog",
  "unstarted",
  "started",
  "done",
  "canceled",
] as const
export type StateCategory = (typeof STATE_CATEGORIES)[number]

export type Issue = {
  readonly id: IssueId
  readonly workspaceId: WorkspaceId
  readonly teamId: TeamId
  readonly number: number
  readonly identifier: IssueIdentifier
  readonly title: string
  readonly description: string
  readonly stateId: StateId
  readonly priority: Priority
  readonly assigneeId: ActorId | null
  readonly creatorId: ActorId
  readonly projectId: ProjectId | null
  readonly cycleId: CycleId | null
  readonly parentId: IssueId | null
  readonly estimate: number | null
  readonly dueDate: string | null
  readonly archivedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly version: number
}

export type IssueSummary = Pick<
  Issue,
  | "id"
  | "teamId"
  | "number"
  | "identifier"
  | "title"
  | "stateId"
  | "priority"
  | "assigneeId"
  | "projectId"
  | "cycleId"
  | "parentId"
  | "updatedAt"
>

export function isTerminal(category: StateCategory): boolean {
  return category === "done" || category === "canceled"
}

export function summarize(issue: Issue): IssueSummary {
  return {
    id: issue.id,
    teamId: issue.teamId,
    number: issue.number,
    identifier: issue.identifier,
    title: issue.title,
    stateId: issue.stateId,
    priority: issue.priority,
    assigneeId: issue.assigneeId,
    projectId: issue.projectId,
    cycleId: issue.cycleId,
    parentId: issue.parentId,
    updatedAt: issue.updatedAt,
  }
}
