import {
  realtimeTicketResponseSchema,
  syncResponseSchema,
} from "@workerbee/realtime"
import type { Changeset } from "@workerbee/realtime"
import type {
  Bootstrap,
  Comment,
  CreateIssueBody,
  CreateLabelBody,
  Issue,
  Label,
  UpdateIssueBody,
  UpdateLabelBody,
  Workspace,
} from "./types"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)

  if (init.body !== undefined) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(path, { ...init, headers, credentials: "include" })

  if (!response.ok) {
    let code = response.statusText

    try {
      const body = (await response.json()) as { error?: string }
      code = body.error ?? code
    } catch {
      // Keep the status text.
    }

    throw new ApiError(response.status, code)
  }

  return (await response.json()) as T
}

async function requestVoid(path: string, init: RequestInit = {}): Promise<void> {
  const headers = new Headers(init.headers)

  if (init.body !== undefined) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(path, { ...init, headers, credentials: "include" })

  if (!response.ok) {
    let code = response.statusText

    try {
      const body = (await response.json()) as { error?: string }
      code = body.error ?? code
    } catch {
      // Keep the status text.
    }

    throw new ApiError(response.status, code)
  }
}

function workspaceHeaders(slug: string): HeadersInit {
  return { "x-workerbee-workspace": slug }
}

export const api = {
  async workspaces(): Promise<Workspace[]> {
    const { workspaces } = await request<{ workspaces: Workspace[] }>("/api/v1/workspaces")

    return workspaces
  },

  bootstrap(slug: string): Promise<Bootstrap> {
    return request<Bootstrap>("/api/v1/bootstrap", { headers: workspaceHeaders(slug) })
  },

  async sync(slug: string, since: number): Promise<Changeset[]> {
    const response: unknown = await request<unknown>(
      `/api/v1/sync?since=${since}&limit=500`,
      { headers: workspaceHeaders(slug) },
    )

    return syncResponseSchema.parse(response).changesets
  },

  async realtimeTicket(slug: string): Promise<{ readonly ticket: string; readonly expiresAt: number }> {
    const response: unknown = await request<unknown>("/api/v1/realtime-ticket", {
      method: "POST",
      headers: workspaceHeaders(slug),
    })

    return realtimeTicketResponseSchema.parse(response)
  },

  async issue(slug: string, id: string): Promise<Issue> {
    const { issue } = await request<{ issue: Issue }>(`/api/v1/issues/${id}`, {
      headers: workspaceHeaders(slug),
    })

    return issue
  },

  createIssue(
    slug: string,
    body: CreateIssueBody,
  ): Promise<{ issue: Issue; seq: number }> {
    return request("/api/v1/issues", {
      method: "POST",
      headers: workspaceHeaders(slug),
      body: JSON.stringify(body),
    })
  },

  updateIssue(
    slug: string,
    id: string,
    body: UpdateIssueBody,
  ): Promise<{ issue: Issue; seq: number | null }> {
    return request(`/api/v1/issues/${id}`, {
      method: "PATCH",
      headers: workspaceHeaders(slug),
      body: JSON.stringify(body),
    })
  },

  async comments(slug: string, id: string): Promise<Comment[]> {
    const { comments } = await request<{ comments: Comment[] }>(
      `/api/v1/issues/${id}/comments`,
      { headers: workspaceHeaders(slug) },
    )

    return comments
  },

  addComment(
    slug: string,
    id: string,
    body: string,
  ): Promise<{ comment: Comment; seq: number }> {
    return request(`/api/v1/issues/${id}/comments`, {
      method: "POST",
      headers: workspaceHeaders(slug),
      body: JSON.stringify({ body }),
    })
  },

  createWorkspace(body: { name: string; slug: string }): Promise<{ id: string; slug: string }> {
    return request("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },

  async labels(slug: string, teamId?: string): Promise<Label[]> {
    const query = teamId === undefined ? "" : `?teamId=${encodeURIComponent(teamId)}`
    const { labels } = await request<{ labels: Label[] }>(`/api/v1/labels${query}`, {
      headers: workspaceHeaders(slug),
    })

    return labels
  },

  createLabel(slug: string, body: CreateLabelBody): Promise<Label> {
    return request("/api/v1/labels", {
      method: "POST",
      headers: workspaceHeaders(slug),
      body: JSON.stringify(body),
    })
  },

  updateLabel(slug: string, id: string, body: UpdateLabelBody): Promise<Label> {
    return request(`/api/v1/labels/${id}`, {
      method: "PATCH",
      headers: workspaceHeaders(slug),
      body: JSON.stringify(body),
    })
  },

  deleteLabel(slug: string, id: string): Promise<void> {
    return requestVoid(`/api/v1/labels/${id}`, {
      method: "DELETE",
      headers: workspaceHeaders(slug),
    })
  },

  attachLabel(slug: string, issueId: string, labelId: string): Promise<void> {
    return requestVoid(`/api/v1/issues/${issueId}/labels`, {
      method: "POST",
      headers: workspaceHeaders(slug),
      body: JSON.stringify({ labelId }),
    })
  },

  detachLabel(slug: string, issueId: string, labelId: string): Promise<void> {
    return requestVoid(`/api/v1/issues/${issueId}/labels/${labelId}`, {
      method: "DELETE",
      headers: workspaceHeaders(slug),
    })
  },
}
