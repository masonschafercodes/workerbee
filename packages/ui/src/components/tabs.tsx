import * as TabsPrimitive from "@radix-ui/react-tabs"
import type { ReactNode } from "react"
import { cn } from "../lib/cn"

export type TabItem = {
  readonly value: string
  readonly label: ReactNode
  readonly content?: ReactNode
}

export type TabsProps = {
  readonly items: readonly TabItem[]
  readonly defaultValue?: string
  readonly value?: string
  readonly onValueChange?: (value: string) => void
  readonly variant?: "underline" | "segmented"
  readonly className?: string
}

export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  variant = "underline",
  className,
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={cn("grid gap-3", className)}
    >
      <TabsPrimitive.List
        className={cn(
          variant === "underline" && "flex gap-1 border-b border-line",
          variant === "segmented" &&
            "inline-flex w-fit items-center gap-0.5 rounded-sm border border-line bg-sunken p-0.5",
        )}
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              "focus-ring flex items-center whitespace-nowrap text-fg-muted transition-colors hover:text-fg",
              "data-[state=active]:text-fg",
              variant === "underline" && [
                "relative h-8 px-2.5 text-sm",
                "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-accent",
                "after:opacity-0 data-[state=active]:after:opacity-100",
              ],
              variant === "segmented" &&
                "h-6 rounded-xs px-2 text-xs data-[state=active]:bg-surface data-[state=active]:shadow-sm",
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value} className="focus-ring rounded-sm">
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
