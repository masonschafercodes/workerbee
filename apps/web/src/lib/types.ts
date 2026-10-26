import { z } from "zod"

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

export const issueSummarySchema = z.object({
  id: z.string(),
  teamId: z.string(),
  number: z.number().int(),
  identifier: z.string(),
  title: z.string(),
  stateId: z.string(),
  priority: z.enum(["none", "urgent", "high", "medium", "low"]),
  assigneeId: z.string().nullable(),
  parentId: z.string().nullable(),
  updatedAt: z.string(),
  version: z.number().int(),
})

export type IssueSummary = z.infer<typeof issueSummarySchema>

export const issueSchema = issueSummarySchema.extend({
  workspaceId: z.string(),
  description: z.string(),
  creatorId: z.string(),
  projectId: z.string().nullable(),
  cycleId: z.string().nullable(),
  estimate: z.number().nullable(),
  dueDate: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
})

export type Issue = z.infer<typeof issueSchema>

export const commentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  authorId: z.string(),
  authorName: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
})

export type Comment = z.infer<typeof commentSchema>

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
