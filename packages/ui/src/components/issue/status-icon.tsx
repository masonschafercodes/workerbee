import type { StateCategory } from "@workerbee/domain"
import { cn } from "../../lib/cn"

const COLORS: Record<StateCategory, string> = {
  backlog: "text-status-backlog",
  unstarted: "text-status-unstarted",
  started: "text-status-started",
  done: "text-status-done",
  canceled: "text-status-canceled",
}

export const STATUS_LABELS: Record<StateCategory, string> = {
  backlog: "Backlog",
  unstarted: "Todo",
  started: "In progress",
  done: "Done",
  canceled: "Canceled",
}

export type StatusIconProps = {
  readonly status: StateCategory
  readonly label?: string
  readonly className?: string
}

export function StatusIcon({ status, label, className }: StatusIconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      className={cn("size-3.5 shrink-0", COLORS[status], className)}
      role={label !== undefined ? "img" : undefined}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      {status === "backlog" ? (
        <circle
          cx="7"
          cy="7"
          r="5.25"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeDasharray="1.9 1.9"
        />
      ) : null}

      {status === "unstarted" ? (
        <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.4" />
      ) : null}

      {status === "started" ? (
        <>
          <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.4" />
          <path d="M7 1.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" />
        </>
      ) : null}

      {status === "done" ? (
        <>
          <circle cx="7" cy="7" r="5.5" fill="currentColor" />
          <path
            d="m4.3 7.15 1.8 1.8 3.6-3.9"
            stroke="var(--wb-canvas)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}

      {status === "canceled" ? (
        <>
          <circle cx="7" cy="7" r="5.5" fill="currentColor" opacity="0.55" />
          <path
            d="m5.1 5.1 3.8 3.8m0-3.8-3.8 3.8"
            stroke="var(--wb-canvas)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </svg>
  )
}
