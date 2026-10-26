import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import type {
  ComponentPropsWithoutRef,
  ReactElement,
  ReactNode,
  Ref,
} from "react"
import { cn } from "../lib/cn"

export type DropdownMenuProps = {
  readonly trigger: ReactElement
  readonly children: ReactNode
  readonly align?: "start" | "center" | "end"
  readonly sideOffset?: number
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly className?: string
}

export function DropdownMenu({
  trigger,
  children,
  align = "end",
  sideOffset = 4,
  open,
  onOpenChange,
  className,
}: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "z-50 min-w-44 rounded-md border border-line bg-overlay p-1 shadow-popover",
            className,
          )}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

export type DropdownMenuItemProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
> & {
  readonly inset?: boolean
  readonly destructive?: boolean
  readonly shortcut?: string
  readonly ref?: Ref<HTMLDivElement>
}

export function DropdownMenuItem({
  className,
  inset = false,
  destructive = false,
  shortcut,
  children,
  ref,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        [
          "flex h-7 cursor-default select-none items-center gap-2 rounded-xs px-2",
          "text-sm text-fg outline-none",
          "data-[highlighted]:bg-accent-subtle data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        ],
        inset && "pl-7",
        destructive && "text-danger data-[highlighted]:bg-danger/10",
        className,
      )}
      {...props}
    >
      {children}
      {shortcut !== undefined ? (
        <span className="ml-auto font-mono text-2xs text-fg-subtle">{shortcut}</span>
      ) : null}
    </DropdownMenuPrimitive.Item>
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-2 py-1.5 text-2xs font-medium text-fg-subtle", className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-line", className)}
      {...props}
    />
  )
}
