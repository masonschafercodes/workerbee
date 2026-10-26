import * as SwitchPrimitive from "@radix-ui/react-switch"
import type { ComponentPropsWithoutRef, Ref } from "react"
import { cn } from "../lib/cn"

export type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  readonly ref?: Ref<HTMLButtonElement>
}

export function Switch({ className, ref, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        [
          "focus-ring inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border",
          "border-line-strong bg-sunken transition-colors",
          "data-[state=checked]:border-accent-solid data-[state=checked]:bg-accent-solid",
          "disabled:cursor-not-allowed disabled:opacity-50",
        ],
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          [
            "block size-3.5 translate-x-[2px] rounded-full bg-fg-muted transition-transform",
            "data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-on-accent",
          ],
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export type SwitchFieldProps = SwitchProps & {
  readonly id: string
  readonly label: string
  readonly description?: string
}

export function SwitchField({
  id,
  label,
  description,
  className,
  ...props
}: SwitchFieldProps) {
  const descriptionId = `${id}-description`

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
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
      <Switch
        id={id}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        {...props}
      />
    </div>
  )
}
