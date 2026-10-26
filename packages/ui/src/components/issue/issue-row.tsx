import type { ActorKind, Priority, StateCategory } from "@workerbee/domain"
import { cn } from "../../lib/cn"
import { Avatar } from "../avatar"
import { PriorityIcon, PRIORITY_LABELS } from "./priority-icon"
import { StatusIcon, STATUS_LABELS } from "./status-icon"

export type IssueAssignee = {
  readonly name: string
  readonly src?: string | null
  readonly kind?: ActorKind
}

export type IssueRowProps = {
  readonly identifier: string
  readonly title: string
  readonly status: StateCategory
  readonly priority: Priority
  readonly assignee?: IssueAssignee
  readonly meta?: string
  readonly selected?: boolean
  readonly className?: string
  readonly onClick?: () => void
}

export function IssueRow({
  identifier,
  title,
  status,
  priority,
  assignee,
  meta,
  selected = false,
  className,
  onClick,
}: IssueRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected || undefined}
      aria-current={selected ? "true" : undefined}
      className={cn(
        [
          "focus-ring-inset flex h-9 w-full items-center gap-2 border-b border-line-subtle px-2 text-left",
          "transition-colors hover:bg-hover",
          "data-[selected]:bg-accent-subtle data-[selected]:hover:bg-accent-subtle",
        ],
        className,
      )}
    >
      <StatusIcon status={status} />
      <span className="sr-only">
        {STATUS_LABELS[status]}, {PRIORITY_LABELS[priority]} priority.
      </span>

      <span
        className={cn(
          "w-14 shrink-0 truncate font-mono text-2xs",
          selected ? "text-fg-muted" : "text-fg-subtle",
        )}
      >
        {identifier}
      </span>

      <PriorityIcon priority={priority} />

      <span className="min-w-0 flex-1 truncate text-sm text-fg">{title}</span>

      {meta !== undefined ? (
        <span
          className={cn(
            "shrink-0 text-2xs",
            selected ? "text-fg-muted" : "text-fg-subtle",
          )}
        >
          {meta}
        </span>
      ) : null}

      {assignee !== undefined ? (
        <Avatar name={assignee.name} src={assignee.src} kind={assignee.kind} size="sm" />
      ) : (
        <span className="size-6 shrink-0" aria-hidden="true" />
      )}
    </button>
  )
}
