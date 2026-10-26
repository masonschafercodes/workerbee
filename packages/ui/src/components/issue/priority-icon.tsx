import type { Priority } from "@workerbee/domain"
import { cn } from "../../lib/cn"

const COLORS: Record<Priority, string> = {
  none: "text-priority-none",
  low: "text-priority-low",
  medium: "text-priority-medium",
  high: "text-priority-high",
  urgent: "text-priority-urgent",
}

const LEVEL: Record<Priority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 3,
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

const BARS = [
  { x: 2.6, height: 4 },
  { x: 5.8, height: 7 },
  { x: 9, height: 10 },
]

export type PriorityIconProps = {
  readonly priority: Priority
  readonly label?: string
  readonly className?: string
}

export function PriorityIcon({ priority, label, className }: PriorityIconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      className={cn("size-3.5 shrink-0", COLORS[priority], className)}
      role={label !== undefined ? "img" : undefined}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      {priority === "urgent" ? (
        <>
          <rect x="2.25" y="2.25" width="9.5" height="9.5" rx="2" fill="currentColor" />
          <path
            d="M7 4.9v2.7"
            stroke="var(--wb-canvas)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="7" cy="9.5" r="0.8" fill="var(--wb-canvas)" />
        </>
      ) : (
        BARS.map((bar, index) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={11 - bar.height}
            width="2.2"
            height={bar.height}
            rx="1"
            fill="currentColor"
            opacity={index < LEVEL[priority] ? 1 : 0.25}
          />
        ))
      )}
    </svg>
  )
}
