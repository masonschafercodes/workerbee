import type { ReactNode } from "react"

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  readonly title: string
  readonly description: string
  readonly children: ReactNode
  readonly footer: ReactNode
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="grid size-6 place-items-center rounded-[6px] bg-accent-solid text-xs font-semibold text-on-accent"
            aria-hidden="true"
          >
            W
          </span>
          <span className="text-sm font-medium text-fg">Workerbee</span>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5">
          <h1 className="text-lg font-medium text-fg">{title}</h1>
          <p className="mt-1 text-sm text-fg-muted">{description}</p>
          <div className="mt-5">{children}</div>
        </div>

        <div className="mt-4 text-center text-xs text-fg-subtle">{footer}</div>
      </div>
    </div>
  )
}
