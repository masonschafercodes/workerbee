import { TooltipProvider } from "@workerbee/ui"
import { Actions } from "./sections/actions"
import { Display } from "./sections/display"
import { Forms } from "./sections/forms"
import { Foundations } from "./sections/foundations"
import { Overlays } from "./sections/overlays"
import { Patterns } from "./sections/patterns"
import { ThemeToggle, useTheme } from "./theme"
import { Block, Page, Panel } from "./ui"

const NAV = [
  { id: "foundations", label: "Foundations" },
  { id: "actions", label: "Actions" },
  { id: "forms", label: "Forms" },
  { id: "overlays", label: "Overlays" },
  { id: "display", label: "Data display" },
  { id: "patterns", label: "Patterns" },
  { id: "accessibility", label: "Accessibility" },
]

function Accessibility() {
  return (
    <Page
      id="accessibility"
      eyebrow="Standards"
      title="Accessibility is part of the component"
      description="The primitives handle focus traps, roving tab index, and ARIA wiring. The gallery is checked with axe in both themes, and every interactive element is reachable by keyboard."
    >
      <Block title="Keyboard" hint="If it can be clicked, it can be reached with Tab and triggered with Enter or Space.">
        <Panel>
          <ul className="grid gap-2 text-sm text-fg-muted">
            <li>Menu and dialog focus returns to the trigger when they close.</li>
            <li>Escape closes overlays. Arrow keys move through menus, selects, and tabs.</li>
            <li>Icon-only buttons carry an `aria-label` by construction.</li>
          </ul>
        </Panel>
      </Block>

      <Block title="Focus" hint="A 2px accent ring with a 2px offset, visible in both themes.">
        <Panel>
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded-sm border border-line bg-surface px-3 py-1.5 text-sm outline-2 outline-offset-2 outline-accent">
              Focused control
            </span>
            <span className="text-xs text-fg-subtle">
              Ring color follows the theme and switches to danger for invalid fields.
            </span>
          </div>
        </Panel>
      </Block>

      <Block title="Color is never alone" hint="Status and priority use shape plus color, and rows include a screen-reader label.">
        <Panel>
          <p className="max-w-2xl text-sm text-fg-muted">
            Todos, progress, and done states differ by icon fill, not only hue. Priority uses
            bar count, with urgent as a filled square. Filter chips carry text labels.
          </p>
        </Panel>
      </Block>

      <Block title="Motion" hint="Reduced motion removes transitions and animation durations.">
        <Panel>
          <p className="max-w-2xl text-sm text-fg-muted">
            The stylesheet honors `prefers-reduced-motion: reduce` globally. Nothing in the
            interface relies on motion to communicate state.
          </p>
        </Panel>
      </Block>
    </Page>
  )
}

export function App() {
  const { theme, setTheme } = useTheme()

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh bg-canvas text-fg">
        <header className="sticky top-0 z-40 border-b border-line bg-canvas">
          <div className="mx-auto flex h-12 max-w-[1240px] items-center gap-3 px-4 lg:px-8">
            <span
              className="grid size-5 place-items-center rounded-[5px] bg-accent-solid text-2xs font-semibold text-on-accent"
              aria-hidden="true"
            >
              W
            </span>
            <span className="text-sm font-medium">Workerbee</span>
            <span className="hidden text-fg-subtle sm:inline" aria-hidden="true">/</span>
            <span className="hidden text-xs text-fg-muted sm:inline">Design system</span>
            <div className="ml-auto">
              <ThemeToggle theme={theme} onChange={setTheme} />
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1240px] gap-10 px-4 py-8 lg:px-8">
          <aside className="hidden w-40 shrink-0 lg:block">
            <nav aria-label="Sections" className="sticky top-20 grid gap-0.5">
              {NAV.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="focus-ring rounded-xs px-2 py-1 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <p className="mt-6 px-2 text-2xs text-fg-subtle">v0.1 · internal</p>
          </aside>

          <main className="grid min-w-0 flex-1 gap-12 pb-24">
            <header className="grid gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
                Workerbee design system
              </h1>
              <p className="max-w-2xl text-sm text-fg-muted">
                Dense, calm, and keyboard first. The interface should disappear behind the work:
                short rows, one border, a single accent, and no decoration that does not carry
                information.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-xs bg-accent-subtle px-1.5 py-0.5 text-2xs font-medium text-accent">
                  Draft
                </span>
                <span className="text-2xs text-fg-subtle">Light and dark</span>
                <span className="text-fg-subtle" aria-hidden="true">·</span>
                <span className="text-2xs text-fg-subtle">4px grid</span>
                <span className="text-fg-subtle" aria-hidden="true">·</span>
                <span className="text-2xs text-fg-subtle">Inter and JetBrains Mono</span>
              </div>
            </header>

            <Foundations />
            <Actions />
            <Forms />
            <Overlays />
            <Display />
            <Patterns />
            <Accessibility />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
