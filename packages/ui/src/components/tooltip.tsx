import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import type { ReactElement, ReactNode } from "react"
import { cn } from "../lib/cn"

export const TooltipProvider = TooltipPrimitive.Provider

export type TooltipProps = {
  readonly content: ReactNode
  readonly children: ReactElement
  readonly side?: "top" | "right" | "bottom" | "left"
  readonly align?: "start" | "center" | "end"
  readonly delay?: number
  readonly className?: string
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delay = 300,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            [
              "z-50 max-w-xs rounded-sm border border-line bg-overlay px-2 py-1",
              "text-xs text-fg shadow-popover",
            ],
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
