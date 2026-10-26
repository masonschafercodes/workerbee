import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react"
import { cn } from "../lib/cn"

const button = cva(
  [
    "focus-ring inline-flex select-none items-center justify-center gap-1.5",
    "whitespace-nowrap rounded-sm font-medium transition-colors duration-100",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent-solid text-on-accent hover:bg-accent-solid-hover",
        secondary: "border border-line bg-surface text-fg hover:bg-hover",
        ghost: "text-fg-muted hover:bg-hover hover:text-fg",
        danger: "bg-danger-solid text-on-danger hover:bg-danger-solid-hover",
        link: "text-accent underline-offset-2 hover:underline",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-sm",
        lg: "h-9 px-3.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    readonly ref?: Ref<HTMLButtonElement>
    readonly loading?: boolean
      readonly leading?: ReactNode
    readonly trailing?: ReactNode
  }

export function Button({
  className,
  variant,
  size,
  loading = false,
  leading,
  trailing,
  children,
  disabled,
  ref,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(button({ variant, size }), className)

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        leading
      )}
      {children}
      {trailing}
    </button>
  )
}
