import type { InputHTMLAttributes, Ref } from "react"
import { cn } from "../lib/cn"

const inputStyles = [
  "h-8 w-full rounded-sm border border-line bg-sunken px-2.5",
  "text-sm text-fg placeholder:text-fg-subtle transition-colors",
  "focus-ring disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-danger aria-invalid:[--wb-ring:var(--wb-danger)]",
]

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  readonly ref?: Ref<HTMLInputElement>
  readonly invalid?: boolean
}

export function Input({ className, invalid = false, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(inputStyles, className)}
      {...props}
    />
  )
}
