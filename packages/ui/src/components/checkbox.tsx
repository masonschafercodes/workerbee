import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check, Minus } from "lucide-react"
import type { ComponentPropsWithoutRef, Ref } from "react"
import { cn } from "../lib/cn"

export type CheckboxProps = ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  readonly ref?: Ref<HTMLButtonElement>
}

export function Checkbox({ className, ref, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        [
          "group focus-ring flex size-4 shrink-0 items-center justify-center rounded-xs border",
          "border-line-strong bg-surface transition-colors",
          "data-[state=checked]:border-accent-solid data-[state=checked]:bg-accent-solid",
          "data-[state=indeterminate]:border-accent-solid data-[state=indeterminate]:bg-accent-solid",
          "disabled:cursor-not-allowed disabled:opacity-50",
        ],
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-on-accent">
        <Check className="size-3 group-data-[state=indeterminate]:hidden" strokeWidth={3} />
        <Minus className="hidden size-3 group-data-[state=indeterminate]:block" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export type CheckboxFieldProps = CheckboxProps & {
  readonly id: string
  readonly label: string
  readonly description?: string
}

export function CheckboxField({
  id,
  label,
  description,
  className,
  ...props
}: CheckboxFieldProps) {
  const descriptionId = `${id}-description`

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Checkbox id={id} aria-describedby={description !== undefined ? descriptionId : undefined} {...props} />
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-sm leading-4 text-fg">
          {label}
        </label>
        {description !== undefined ? (
          <p id={descriptionId} className="text-xs text-fg-subtle">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
