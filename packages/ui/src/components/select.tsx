import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../lib/cn"
import { assertSelectOptions, type SelectOption } from "./select-options"

export type { SelectOption }

export type SelectProps = {
  readonly options: readonly SelectOption[]
  readonly value?: string
  readonly defaultValue?: string
  readonly onValueChange?: (value: string) => void
  readonly placeholder?: string
  readonly id?: string
  readonly name?: string
  readonly disabled?: boolean
  readonly className?: string
  readonly "aria-label"?: string
}

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select an option",
  id,
  name,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  assertSelectOptions(options)

  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          [
            "focus-ring flex h-8 w-full items-center justify-between gap-2 rounded-sm",
            "border border-line bg-sunken px-2.5 text-sm text-fg",
            "data-[placeholder]:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-50",
          ],
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-3.5 text-fg-subtle" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
            "rounded-md border border-line bg-overlay shadow-popover",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  [
                    "relative flex h-7 select-none items-center rounded-xs pl-7 pr-2",
                    "text-sm text-fg outline-none",
                    "data-[highlighted]:bg-accent-subtle data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  ],
                )}
              >
                <span className="absolute left-2 flex size-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-3.5 text-accent" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
