import type { Ref, TextareaHTMLAttributes } from "react"
import { cn } from "../lib/cn"

const textareaStyles = [
  "min-h-24 w-full resize-y rounded-sm border border-line bg-sunken px-2.5 py-2",
  "text-sm text-fg placeholder:text-fg-subtle transition-colors",
  "focus-ring disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-danger aria-invalid:[--wb-ring:var(--wb-danger)]",
]

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  readonly ref?: Ref<HTMLTextAreaElement>
  readonly invalid?: boolean
}

export function Textarea({ className, invalid = false, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(textareaStyles, className)}
      {...props}
    />
  )
}
