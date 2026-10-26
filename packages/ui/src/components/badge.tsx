import { cva, type VariantProps } from "class-variance-authority"
import type { HTMLAttributes } from "react"
import { cn } from "../lib/cn"

const badge = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-xs border font-medium",
  {
    variants: {
      variant: {
        neutral: "border-line-subtle bg-raised text-fg-muted",
        outline: "border-line text-fg-muted",
        accent: "border-transparent bg-accent-subtle text-accent",
        success: "border-transparent bg-status-done/10 text-status-done",
        warning: "border-transparent bg-status-started/10 text-status-started",
        danger: "border-transparent bg-danger/10 text-danger",
      },
      size: {
        sm: "h-5 px-1.5 text-2xs",
        md: "h-6 px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
    },
  },
)

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant, size }), className)} {...props} />
}
