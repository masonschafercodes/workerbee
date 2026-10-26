import { Block, Page, Swatch } from "../ui"

const SURFACES = [
  { name: "Canvas", token: "--wb-canvas", className: "bg-canvas" },
  { name: "Surface", token: "--wb-surface", className: "bg-surface" },
  { name: "Raised", token: "--wb-raised", className: "bg-raised" },
  { name: "Sunken", token: "--wb-sunken", className: "bg-sunken" },
  { name: "Overlay", token: "--wb-overlay", className: "bg-overlay" },
]

const TEXT = [
  { name: "Primary", token: "--wb-fg", className: "bg-fg" },
  { name: "Muted", token: "--wb-fg-muted", className: "bg-fg-muted" },
  { name: "Subtle", token: "--wb-fg-subtle", className: "bg-fg-subtle" },
  { name: "Disabled", token: "--wb-fg-disabled", className: "bg-fg-disabled" },
]

const LINES = [
  { name: "Subtle", token: "--wb-line-subtle", className: "bg-line-subtle" },
  { name: "Default", token: "--wb-line", className: "bg-line" },
  { name: "Strong", token: "--wb-line-strong", className: "bg-line-strong" },
]

const ACCENT = [
  { name: "Accent text", token: "--wb-accent", className: "bg-accent" },
  { name: "Accent solid", token: "--wb-accent-solid", className: "bg-accent-solid" },
  { name: "Accent subtle", token: "--wb-accent-subtle", className: "bg-accent-subtle" },
  { name: "Danger", token: "--wb-danger", className: "bg-danger" },
]

const STATUS = [
  { name: "Backlog", token: "--wb-status-backlog", className: "bg-status-backlog" },
  { name: "Todo", token: "--wb-status-unstarted", className: "bg-status-unstarted" },
  { name: "In progress", token: "--wb-status-started", className: "bg-status-started" },
  { name: "Done", token: "--wb-status-done", className: "bg-status-done" },
  { name: "Canceled", token: "--wb-status-canceled", className: "bg-status-canceled" },
]

const PRIORITY = [
  { name: "Urgent", token: "--wb-priority-urgent", className: "bg-priority-urgent" },
  { name: "High", token: "--wb-priority-high", className: "bg-priority-high" },
  { name: "Medium", token: "--wb-priority-medium", className: "bg-priority-medium" },
  { name: "Low", token: "--wb-priority-low", className: "bg-priority-low" },
  { name: "None", token: "--wb-priority-none", className: "bg-priority-none" },
]

const TYPE = [
  { name: "Display", spec: "24 / 32 · semibold", className: "text-2xl font-semibold tracking-[-0.02em]", sample: "Plan the week" },
  { name: "Title", spec: "20 / 28 · semibold", className: "text-xl font-semibold tracking-[-0.01em]", sample: "Active issues" },
  { name: "Heading", spec: "16 / 24 · medium", className: "text-lg font-medium", sample: "Cycle 14" },
  { name: "Body", spec: "14 / 22", className: "text-base", sample: "Sync resumes from the last seq the client applied." },
  { name: "UI", spec: "13 / 20", className: "text-sm", sample: "Bootstrap returns issue summaries and a cursor." },
  { name: "Meta", spec: "12 / 18 · muted", className: "text-xs text-fg-muted", sample: "Updated 2 hours ago by Atlas" },
  { name: "Label", spec: "11 / 16 · medium caps", className: "text-2xs font-medium uppercase tracking-[0.08em] text-fg-subtle", sample: "In progress" },
  { name: "Mono", spec: "12 / 16 · JetBrains Mono", className: "font-mono text-xs", sample: "ENG-412" },
]

const SPACING = [2, 4, 8, 12, 16, 24, 32, 48]

const RADII = [
  { name: "xs", className: "rounded-xs", token: "4px" },
  { name: "sm", className: "rounded-sm", token: "6px" },
  { name: "md", className: "rounded-md", token: "8px" },
  { name: "lg", className: "rounded-lg", token: "10px" },
]

export function Foundations() {
  return (
    <Page
      id="foundations"
      eyebrow="Foundations"
      title="Tokens carry the decisions"
      description="Raw color, type, radius, and elevation values live in one stylesheet. Components only use semantic tokens, so a theme change is a token change rather than a sweep through every file."
    >
      <Block title="Surfaces" hint="Flat by default. Depth comes from one border, not a stack of shadows.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {SURFACES.map((swatch) => <Swatch key={swatch.token} {...swatch} />)}
        </div>
      </Block>

      <Block title="Text and lines" hint="Four text levels and three line levels. Nothing else.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {TEXT.map((swatch) => <Swatch key={swatch.token} {...swatch} />)}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {LINES.map((swatch) => <Swatch key={swatch.token} {...swatch} />)}
          </div>
        </div>
      </Block>

      <Block title="Accent, status, and priority" hint="Color never carries meaning alone. Every status and priority also has an icon or a label.">
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {ACCENT.map((swatch) => <Swatch key={swatch.token} {...swatch} />)}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {STATUS.map((swatch) => <Swatch key={swatch.token} {...swatch} />)}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {PRIORITY.map((swatch) => <Swatch key={swatch.token} {...swatch} />)}
          </div>
        </div>
      </Block>

      <Block title="Type scale" hint="Inter Variable for the interface, JetBrains Mono for identifiers and keys.">
        <div className="divide-y divide-line-subtle rounded-md border border-line bg-surface">
          {TYPE.map((row) => (
            <div key={row.name} className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:items-baseline">
              <div className="grid gap-0.5">
                <span className="text-xs font-medium text-fg">{row.name}</span>
                <span className="font-mono text-2xs text-fg-subtle">{row.spec}</span>
              </div>
              <p className={row.className}>{row.sample}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Spacing" hint="4px base. Controls are 28, 32, or 36 pixels tall. List rows are 36.">
        <div className="grid gap-2 rounded-md border border-line bg-surface p-4">
          {SPACING.map((size) => (
            <div key={size} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-right font-mono text-2xs text-fg-subtle">{size}</span>
              <div
                className="h-2 rounded-xs bg-accent/50"
                style={{ width: `${size * 4}px` }}
              />
            </div>
          ))}
        </div>
      </Block>

      <Block title="Radius and elevation" hint="Radius stays between 4 and 10 pixels. Shadows belong to overlays only.">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-wrap gap-4">
            {RADII.map((radius) => (
              <div key={radius.name} className="grid gap-1.5 text-center">
                <div className={`size-16 border border-line-strong bg-raised ${radius.className}`} />
                <span className="text-xs text-fg">{radius.name}</span>
                <span className="font-mono text-2xs text-fg-subtle">{radius.token}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="grid h-20 flex-1 place-items-center rounded-md border border-line bg-overlay shadow-popover">
              <span className="text-xs text-fg-muted">shadow-popover</span>
            </div>
            <div className="grid h-20 flex-1 place-items-center rounded-md border border-line bg-overlay shadow-overlay">
              <span className="text-xs text-fg-muted">shadow-overlay</span>
            </div>
          </div>
        </div>
      </Block>

      <Block title="Motion" hint="Short and functional. Reduced motion removes all of it.">
        <div className="grid gap-2 rounded-md border border-line bg-surface p-4 text-sm sm:grid-cols-3">
          <div className="grid gap-0.5">
            <span className="text-fg">100ms</span>
            <span className="text-xs text-fg-subtle">Hover, color</span>
          </div>
          <div className="grid gap-0.5">
            <span className="text-fg">140ms</span>
            <span className="text-xs text-fg-subtle">Menus, selects</span>
          </div>
          <div className="grid gap-0.5">
            <span className="text-fg">200ms</span>
            <span className="text-xs text-fg-subtle">Panels, dialogs</span>
          </div>
        </div>
      </Block>
    </Page>
  )
}
