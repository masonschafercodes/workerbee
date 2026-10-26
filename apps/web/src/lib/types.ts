export type WorkspaceRole = "owner" | "admin" | "member"

export type Workspace = {
  id: string
  slug: string
  name: string
  role: WorkspaceRole
}

export type Team = {
  id: string
  key: string
  name: string
  issueCounter: number
}

export type StateCategory = "backlog" | "unstarted" | "started" | "done" | "canceled"

export type WorkflowState = {
  id: string
  teamId: string
  name: string
  category: StateCategory
  position: number
}

export type Member = {
  actorId: string
  role: WorkspaceRole
  kind: "user" | "agent"
  name: string | null
}

export type Priority = "none" | "urgent" | "high" | "medium" | "low"

export type IssueSummary = {
  id: string
  teamId: string
  number: number
  identifier: string
  title: string
  stateId: string
  priority: Priority
  assigneeId: string | null
  parentId: string | null
  updatedAt: string
  version: number
}

export type Issue = IssueSummary & {
  workspaceId: string
  description: string
  creatorId: string
  projectId: string | null
  cycleId: string | null
  estimate: number | null
  dueDate: string | null
  archivedAt: string | null
  createdAt: string
}

export type Comment = {
  id: string
  issueId: string
  authorId: string
  authorName: string | null
  body: string
  createdAt: string
  editedAt: string | null
}

export type Bootstrap = {
  seq: number
  workspace: {
    id: string
    slug: string
    name: string
  }
  teams: Team[]
  states: WorkflowState[]
  members: Member[]
  issues: IssueSummary[]
  actor: {
    id: string
    kind: "user" | "agent"
  }
  teamScope: "all" | string[]
}

export type UpdateIssueBody = {
  title?: string
  description?: string
  stateId?: string
  priority?: Priority
  version?: number
}

export type CreateIssueBody = {
  teamId: string
  stateId: string
  title: string
  description?: string
  priority?: Priority
}
