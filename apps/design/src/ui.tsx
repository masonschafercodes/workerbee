import type { ReactNode } from "react"
import { cn } from "@workerbee/ui"

export function Page({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  readonly id: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 border-t border-line-subtle pt-10 first:border-t-0 first:pt-0"
    >
      <header className="mb-6 grid gap-1.5">
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-fg-subtle">
          {eyebrow}
        </p>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        <p className="max-w-2xl text-sm text-fg-muted">{description}</p>
      </header>
      <div className="grid gap-8">{children}</div>
    </section>
  )
}

export function Block({
  title,
  hint,
  children,
  className,
}: {
  readonly title?: string
  readonly hint?: string
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      {title !== undefined ? (
        <div className="grid gap-0.5">
          <h3 className="text-sm font-medium text-fg">{title}</h3>
          {hint !== undefined ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function Row({
  children,
  className,
}: {
  readonly children: ReactNode
  readonly className?: string
}) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
}

export function Panel({
  children,
  className,
}: {
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <div className={cn("rounded-md border border-line bg-surface p-4", className)}>
      {children}
    </div>
  )
}

export function Swatch({
  name,
  token,
  className,
}: {
  readonly name: string
  readonly token: string
  readonly className: string
}) {
  return (
    <div className="grid gap-1.5">
      <div className={cn("h-10 rounded-sm border border-line-subtle", className)} />
      <div className="grid gap-0.5">
        <span className="text-xs font-medium text-fg">{name}</span>
        <span className="truncate font-mono text-2xs text-fg-subtle">{token}</span>
      </div>
    </div>
  )
}
