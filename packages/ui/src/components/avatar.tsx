import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const avatar = cva("inline-flex shrink-0 select-none items-center justify-center overflow-hidden", {
  variants: {
    size: {
      xs: "size-5 text-[10px]",
      sm: "size-6 text-2xs",
      md: "size-7 text-xs",
    },
    kind: {
      user: "rounded-full border border-line-subtle bg-raised text-fg-muted",
      agent: "rounded-[5px] border border-accent/30 bg-accent-subtle text-accent",
    },
  },
  defaultVariants: {
    size: "md",
    kind: "user",
  },
})

export type AvatarProps = VariantProps<typeof avatar> & {
  readonly name: string
  readonly src?: string | null | undefined
  readonly className?: string
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return "?"
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase()
  }

  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
}

export function Avatar({ name, src, size, kind, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root className={cn(avatar({ size, kind }), className)}>
      {src !== undefined && src !== null ? (
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          className="size-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={src === undefined || src === null ? 0 : 300}
        className="flex size-full items-center justify-center font-medium"
        aria-label={name}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
