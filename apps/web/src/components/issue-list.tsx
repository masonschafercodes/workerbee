import { Inbox } from "lucide-react"
import { useMemo } from "react"
import { Badge, Button, IssueRow, Tabs } from "@workerbee/ui"
import { relativeTime } from "../lib/format"
import type { WorkspaceSearch, WorkspaceView } from "../lib/search"
import type { Bootstrap } from "../lib/types"

const VIEWS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "backlog", label: "Backlog" },
  { value: "done", label: "Done" },
]

function matchesView(category: string, view: WorkspaceView): boolean {
  switch (view) {
    case "all":
      return true
    case "active":
      return category === "started"
    case "backlog":
      return category === "backlog" || category === "unstarted"
    case "done":
      return category === "done" || category === "canceled"
  }
}

export type IssueListProps = {
  readonly bootstrap: Bootstrap
  readonly search: WorkspaceSearch
  readonly selectedIdentifier: string | undefined
  readonly onSelect: (identifier: string) => void
  readonly onCreate: () => void
  readonly onViewChange: (view: WorkspaceView) => void
}

export function IssueList({
  bootstrap,
  search,
  selectedIdentifier,
  onSelect,
  onCreate,
  onViewChange,
}: IssueListProps) {
  const stateById = useMemo(
    () => new Map(bootstrap.states.map((state) => [state.id, state])),
    [bootstrap.states],
  )
  const memberById = useMemo(
    () => new Map(bootstrap.members.map((member) => [member.actorId, member])),
    [bootstrap.members],
  )
  const teamById = useMemo(
    () => new Map(bootstrap.teams.map((team) => [team.id, team])),
    [bootstrap.teams],
  )

  const query = search.q.trim().toLowerCase()
  const activeTeam = search.team === undefined ? undefined : teamById.get(search.team)

  const issues = useMemo(
    () =>
      bootstrap.issues.filter((issue) => {
        const state = stateById.get(issue.stateId)

        if (state === undefined || !matchesView(state.category, search.view)) {
          return false
        }

        if (search.team !== undefined && issue.teamId !== search.team) {
          return false
        }

        if (query === "") {
          return true
        }

        return (
          issue.title.toLowerCase().includes(query) ||
          issue.identifier.toLowerCase().includes(query)
        )
      }),
    [bootstrap.issues, stateById, search.view, search.team, query],
  )

  return (
    <div className="min-h-full">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h1 className="text-base font-medium text-fg">
          {activeTeam?.name ?? "All issues"}
        </h1>
        <Badge>{issues.length}</Badge>
      </div>

      <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-2">
        <Tabs
          variant="segmented"
          items={VIEWS}
          value={search.view}
          onValueChange={(value) => onViewChange(value as WorkspaceView)}
          className="gap-0"
        />
        {query !== "" ? (
          <span className="text-xs text-fg-subtle">Filtering by “{search.q}”</span>
        ) : null}
      </div>

      {issues.length === 0 ? (
        <div className="grid place-items-center gap-2 px-6 py-20 text-center">
          <Inbox className="size-5 text-fg-subtle" aria-hidden="true" />
          <p className="text-sm font-medium text-fg">
            {bootstrap.issues.length === 0 ? "No issues yet" : "No issues match this view"}
          </p>
          <p className="max-w-xs text-xs text-fg-muted">
            {bootstrap.issues.length === 0
              ? "Create the first issue and it will appear here."
              : "Clear the search or change the filter."}
          </p>
          <Button variant="secondary" size="sm" onClick={onCreate}>
            Create issue
          </Button>
        </div>
      ) : (
        <ul aria-label="Issues">
          {issues.map((issue) => {
            const state = stateById.get(issue.stateId)
            const member =
              issue.assigneeId === null ? undefined : memberById.get(issue.assigneeId)

            if (state === undefined) {
              return null
            }

            return (
              <li key={issue.id}>
                <IssueRow
                  identifier={issue.identifier}
                  title={issue.title}
                  status={state.category}
                  priority={issue.priority}
                  {...(member?.name !== undefined && member.name !== null
                    ? { assignee: { name: member.name, kind: member.kind } }
                    : {})}
                  meta={relativeTime(issue.updatedAt)}
                  selected={selectedIdentifier === issue.identifier}
                  onClick={() => onSelect(issue.identifier)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
