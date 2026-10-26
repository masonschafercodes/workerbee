import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { ReactElement, ReactNode } from "react"
import { cn } from "../lib/cn"
import { IconButton } from "./icon-button"

export type DialogProps = {
  readonly trigger: ReactElement
  readonly title: string
  readonly description?: string
  readonly children?: ReactNode
  readonly footer?: ReactNode
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly className?: string
}

export function Dialog({
  trigger,
  title,
  description,
  children,
  footer,
  open,
  onOpenChange,
  className,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <DialogPrimitive.Content
          className={cn(
            [
              "fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2",
              "rounded-lg border border-line bg-overlay p-4 shadow-overlay focus:outline-none",
            ],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <DialogPrimitive.Title className="text-base font-medium text-fg">
                {title}
              </DialogPrimitive.Title>
              {description !== undefined ? (
                <DialogPrimitive.Description className="text-sm text-fg-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close dialog" size="sm">
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>

          {children !== undefined ? <div className="mt-3">{children}</div> : null}

          {footer !== undefined ? (
            <div className="mt-4 flex items-center justify-end gap-2">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
