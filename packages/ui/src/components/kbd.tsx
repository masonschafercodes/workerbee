import type { HTMLAttributes } from "react"
import { cn } from "../lib/cn"

export function Kbd({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        [
          "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line",
          "bg-raised px-1 font-mono text-2xs leading-none text-fg-muted",
        ],
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}
