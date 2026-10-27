import { Inbox, LogOut, Tag } from "lucide-react"
import {
  Avatar,
  Badge,
  IconButton,
  Select,
  Tooltip,
} from "@workerbee/ui"
import type { Team, Workspace } from "../lib/types"

export type SidebarProps = {
  readonly slug: string
  readonly workspaces: readonly Workspace[]
  readonly teams: readonly Team[]
  readonly teamCounts: Readonly<Record<string, number>>
  readonly activeTeamId: string | undefined
  readonly settingsActive: boolean
  readonly onOpenSettings: () => void
  readonly userName: string
  readonly userEmail: string
  readonly onWorkspaceChange: (slug: string) => void
  readonly onSelectTeam: (teamId: string | undefined) => void
  readonly onSignOut: () => void
}

export function Sidebar({
  slug,
  workspaces,
  teams,
  teamCounts,
  activeTeamId,
  settingsActive,
  onOpenSettings,
  userName,
  userEmail,
  onWorkspaceChange,
  onSelectTeam,
  onSignOut,
}: SidebarProps) {
  return (
    <aside
      aria-label="Workspace navigation"
      className="hidden w-52 shrink-0 flex-col border-r border-line bg-canvas lg:flex"
    >
      <div className="flex h-12 items-center gap-2 px-3">
        <span
          className="grid size-5 place-items-center rounded-[5px] bg-accent-solid text-2xs font-semibold text-on-accent"
          aria-hidden="true"
        >
          W
        </span>
        <span className="truncate text-sm font-medium text-fg">Workerbee</span>
      </div>

      <div className="px-2 pb-2">
        <Select
          aria-label="Workspace"
          options={workspaces.map((workspace) => ({
            value: workspace.slug,
            label: workspace.name,
          }))}
          value={slug}
          onValueChange={onWorkspaceChange}
          className="h-7 text-xs"
        />
      </div>

      <nav aria-label="Workspace" className="grid gap-0.5 px-2">
        <button
          type="button"
          onClick={() => onSelectTeam(undefined)}
          aria-current={!settingsActive && activeTeamId === undefined ? "page" : undefined}
          className="focus-ring flex h-7 items-center gap-2 rounded-xs px-2 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
        >
          <Inbox className="size-3.5" aria-hidden="true" />
          All issues
        </button>
      </nav>

      <div className="mt-4 grid gap-1 px-2">
        <p className="px-2 text-2xs font-medium uppercase tracking-[0.08em] text-fg-subtle">
          Teams
        </p>
        <nav aria-label="Teams" className="grid gap-0.5">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => onSelectTeam(team.id)}
              aria-current={!settingsActive && activeTeamId === team.id ? "page" : undefined}
              className="focus-ring flex h-7 items-center gap-2 rounded-xs px-2 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
            >
              <span className="font-mono text-2xs text-fg-subtle">{team.key}</span>
              <span className="truncate">{team.name}</span>
              <Badge className="ml-auto">{teamCounts[team.id] ?? 0}</Badge>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto grid gap-0.5 px-2 pb-2">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-current={settingsActive ? "page" : undefined}
          className="focus-ring flex h-7 items-center gap-2 rounded-xs px-2 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
        >
          <Tag className="size-3.5" aria-hidden="true" />
          Labels
        </button>
      </div>

      <div className="flex items-center gap-2 border-t border-line p-2">
        <Avatar name={userName} size="sm" />
        <div className="grid min-w-0 flex-1">
          <span className="truncate text-xs font-medium text-fg">{userName}</span>
          <span className="truncate text-2xs text-fg-subtle">{userEmail}</span>
        </div>
        <Tooltip content="Sign out">
          <IconButton label="Sign out" size="sm" onClick={onSignOut}>
            <LogOut className="size-3.5" aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </div>
    </aside>
  )
}
