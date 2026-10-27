import { Outlet, useNavigate, useParams, useRouterState, useSearch } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { CreateIssueDialog } from "../components/create-issue-dialog"
import { IssueList } from "../components/issue-list"
import { Sidebar } from "../components/sidebar"
import { ErrorScreen, LoadingScreen } from "../components/states"
import { Topbar } from "../components/topbar"
import { identifyUser, resetAnalytics } from "../lib/analytics"
import { authClient } from "../lib/auth"
import { useBootstrap, useWorkspaces } from "../lib/hooks"
import { useRealtime } from "../lib/realtime"
import { queryClient } from "../lib/query"
import type { WorkspaceSearch } from "../lib/search"

export function WorkspacePage() {
  const { workspace: slug } = useParams({ strict: false }) as { workspace: string }
  const search = useSearch({ strict: false }) as WorkspaceSearch
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const session = authClient.useSession()
  const bootstrap = useBootstrap(slug)
  const workspaces = useWorkspaces()
  useRealtime(slug, bootstrap.data !== undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {}

    for (const issue of bootstrap.data?.issues ?? []) {
      counts[issue.teamId] = (counts[issue.teamId] ?? 0) + 1
    }

    return counts
  }, [bootstrap.data?.issues])

  const selectedIdentifier = pathname.match(/\/issues\/([^/]+)$/)?.[1]
  const settingsActive = pathname.endsWith("/settings/labels")
  const userId = session.data?.user.id
  const userEmail = session.data?.user.email
  const userName = session.data?.user.name

  useEffect(() => {
    if (userId !== undefined && userEmail !== undefined && userName !== undefined) {
      identifyUser(userId, userEmail, userName)
    }
  }, [userId, userEmail, userName])

  if (session.isPending || bootstrap.isPending) {
    return <LoadingScreen />
  }

  if (bootstrap.isError) {
    return (
      <ErrorScreen
        message={bootstrap.error.message}
        onRetry={() => void bootstrap.refetch()}
      />
    )
  }

  const user = session.data?.user

  if (user === undefined) {
    return <LoadingScreen />
  }

  const data = bootstrap.data

  function go(patch: Partial<WorkspaceSearch>) {
    void navigate({
      to: "/w/$workspace",
      params: { workspace: slug },
      search: { ...search, ...patch },
    })
  }

  async function signOut() {
    await authClient.signOut()
    resetAnalytics()
    queryClient.clear()
    await navigate({ to: "/sign-in" })
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar
        slug={slug}
        workspaces={workspaces.data ?? []}
        teams={data.teams}
        teamCounts={teamCounts}
        activeTeamId={search.team}
        userName={user.name}
        userEmail={user.email}
        onWorkspaceChange={(next) => {
          void navigate({
            to: "/w/$workspace",
            params: { workspace: next },
            search: { view: "all", q: "", team: undefined },
          })
        }}
        onSelectTeam={(teamId) => go({ team: teamId })}
        settingsActive={settingsActive}
        onOpenSettings={() => {
          void navigate({
            to: "/w/$workspace/settings/labels",
            params: { workspace: slug },
            search,
          })
        }}
        onSignOut={() => void signOut()}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar
          workspaceName={data.workspace.name}
          query={search.q}
          onQueryChange={(q) => go({ q })}
          onCreateIssue={() => setCreateOpen(true)}
        />

        <div className="flex min-h-0 flex-1">
          {settingsActive ? null : (
            <div className="min-w-0 flex-1 overflow-y-auto">
              <IssueList
                bootstrap={data}
                search={search}
                selectedIdentifier={selectedIdentifier}
                onSelect={(identifier) => {
                  void navigate({
                    to: "/w/$workspace/issues/$identifier",
                    params: { workspace: slug, identifier },
                    search,
                  })
                }}
                onCreate={() => setCreateOpen(true)}
                onViewChange={(view) => go({ view })}
              />
            </div>
          )}

          <Outlet />
        </div>
      </main>

      <CreateIssueDialog
        slug={slug}
        bootstrap={data}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(issue) => {
          void navigate({
            to: "/w/$workspace/issues/$identifier",
            params: { workspace: slug, identifier: issue.identifier },
            search: { ...search, view: "all" },
          })
        }}
      />
    </div>
  )
}
