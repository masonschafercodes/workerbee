import { cn } from "../lib/cn"

export type LabelChipProps = {
  readonly name: string
  readonly color: string
  readonly scope: "workspace" | "team"
  readonly className?: string
}

export function LabelChip({ name, color, scope, className }: LabelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-xs border border-line-subtle bg-raised px-1.5 py-0.5 text-2xs font-medium text-fg-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 border border-line-subtle",
          scope === "workspace" ? "rounded-full" : "rounded-[2px]",
        )}
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{name}</span>
    </span>
  )
}
