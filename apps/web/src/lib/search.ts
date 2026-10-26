export const WORKSPACE_VIEWS = ["all", "active", "backlog", "done"] as const

export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number]

export type WorkspaceSearch = {
  view: WorkspaceView
  q: string
  team: string | undefined
}

export function validateWorkspaceSearch(input: Record<string, unknown>): WorkspaceSearch {
  const view = WORKSPACE_VIEWS.includes(input.view as WorkspaceView)
    ? (input.view as WorkspaceView)
    : "all"

  return {
    view,
    q: typeof input.q === "string" ? input.q : "",
    team:
      typeof input.team === "string" && input.team !== "" ? input.team : undefined,
  }
}
