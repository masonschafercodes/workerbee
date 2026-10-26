import { cva, type VariantProps } from "class-variance-authority"
import type { ButtonHTMLAttributes, Ref } from "react"
import { cn } from "../lib/cn"

const iconButton = cva(
  [
    "focus-ring inline-flex shrink-0 items-center justify-center rounded-sm",
    "transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        ghost: "text-fg-muted hover:bg-hover hover:text-fg",
        secondary: "border border-line bg-surface text-fg-muted hover:bg-hover hover:text-fg",
      },
      size: {
        sm: "size-6",
        md: "size-7",
        lg: "size-8",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
)

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> &
  VariantProps<typeof iconButton> & {
      readonly label: string
    readonly ref?: Ref<HTMLButtonElement>
  }

export function IconButton({
  className,
  variant,
  size,
  label,
  ref,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(iconButton({ variant, size }), className)}
      {...props}
    />
  )
}
