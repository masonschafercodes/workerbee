# Workerbee design system

The interface should disappear behind the work. Dense rows, one border, a single accent, and no
decoration that does not carry information.

[The gallery](../apps/design) renders every token and component in light and dark. Treat it as the
source of truth for how things look, and this file as the rules for using them.

## The design contract

| Decision | Rule |
| --- | --- |
| Density | 36px list rows. Controls at 28, 32, or 36px. 13px UI text. |
| Hierarchy | One page title, one section title, one primary action per view. |
| Surfaces | Flat. Depth comes from a 1px border. Shadows belong to overlays. |
| Accent | Indigo, used for primary actions, selection, links, and focus. Nothing else. |
| Status | Color plus shape. Never color alone. |
| Motion | 100 to 200ms, functional, removed under reduced motion. |
| Radius | 4px small, 6px controls, 8px panels, 10px overlays. No pills except avatars. |

## Foundations

### Color roles

Raw color values live in `packages/ui/src/styles.css` and nowhere else. Components use utilities
such as `bg-surface`, `text-fg-muted`, or `text-status-done`. Dimensions use the scale; a few local
sizes, such as the 5px agent radius and the 18px switch, are explicit.

Workflow states use five categories: backlog, unstarted, started, done, and canceled. Each has a
distinct icon shape, so the state survives a grayscale screenshot and a color-blind reader.

| Group | Roles | Use |
| --- | --- | --- |
| Surface | `canvas`, `surface`, `raised`, `sunken`, `overlay` | Page, panel, chip fill, input well, menu. |
| Hover | `hover` | Pointer feedback. Defined per theme, because light darkens and dark lightens. |
| Line | `line-subtle`, `line`, `line-strong` | Row dividers, panel borders, input borders. |
| Text | `fg`, `fg-muted`, `fg-subtle`, `fg-disabled` | Primary, secondary, metadata, disabled. |
| Accent | `accent`, `accent-solid`, `accent-subtle`, `on-accent` | Links and icons, primary buttons, selected rows. |
| Feedback | `danger`, `danger-solid`, `status-*` | Errors, destructive actions, workflow state. |
| Priority | `priority-*` | Issue priority bars and urgent marker. |

`fg-subtle` meets AA against canvas, surface, and a selected row. Do not create a fifth text level
to get "softer" text. Use size and weight instead.

### Type

Inter Variable for the interface. JetBrains Mono for identifiers, sequence numbers, and keys.

| Role | Size / line | Use |
| --- | --- | --- |
| Display | 24 / 32 semibold | Page title, empty state title on a full page. |
| Title | 20 / 28 semibold | Section title. |
| Heading | 16 / 24 medium | Panel and dialog title. |
| Body | 14 / 22 | Prose and issue descriptions. |
| UI | 13 / 20 | Default for controls, rows, and labels. |
| Meta | 12 / 18 | Timestamps, counts, hints. |
| Label | 11 / 16 medium caps | Eyebrows and group labels. |
| Mono | 12 / 16 | `ENG-412`, `seq 4821`, shortcuts. |

### Space, radius, and motion

Spacing is a 4px scale. Controls are 28, 32, or 36px tall. Rows are 36px. Radius stays between 4
and 10px. Motion uses 100ms for color, 140ms for menus, and 200ms for panels, always with
`prefers-reduced-motion` respected.

## Component rules

- **Button**: one primary per view. Secondary is the default. Ghost is for low-emphasis actions in
  dense toolbars. Danger only for destructive actions. Loading keeps the label and the width.
- **Icon button**: no visible text, so `label` is not optional. A tooltip supplements it, never
  replaces it.
- **Form field**: label above the control. One hint or one error, never both. Errors use
  `role="alert"` and the input gets `aria-invalid`. Disabled fields keep their label.
- **Select**: use for short, known lists. Use a combobox when the list is long or searchable.
- **Dialog**: for a focused edit that should not navigate away. Always has a title, a close
  control, and an Escape path. Footer actions sit on the right, primary last.
- **Menu**: destructive items go last, after a separator, in text not just red.
- **Tabs**: underline for views of the same list, segmented for a mode switch.
- **Issue row**: one button, 36px, no nested controls. Status and priority are icons plus a
  screen-reader label. Metadata truncates before the title.
- **Empty state**: name the state, say what to do next, offer one action. No illustrations.

## Accessibility

Target WCAG 2.1 AA. The primitives use Radix for focus traps, roving tab index, and ARIA wiring.

- Every interactive element is reachable by Tab and triggered with Enter or Space.
- Focus is a 2px accent ring with a 2px offset. Invalid fields switch the ring to danger.
- Overlays close on Escape and return focus to the trigger.
- Color is never the only signal for status or priority.
- The gallery is checked with axe in both themes. It currently reports no violations.
- Reduced motion removes transitions and animation durations globally.

## Responsive rules

Breakpoints are Tailwind defaults. Below 640px the sidebar becomes a top section list, the theme
control becomes icon-only, toolbars wrap, and issue metadata truncates. The gallery is checked at
390px and 1280px with no horizontal scroll.

## Adding a component

1. Put it in `packages/ui/src/components` and export it from `src/index.ts`.
2. Use semantic tokens only. `tokens.test.ts` fails on raw hex, rgb, hsl, or oklch values.
3. Compose a Radix primitive for anything with focus management. Do not reimplement a focus trap.
4. Add an example to the gallery with its variants, sizes, and states.
5. Check keyboard use, axe in both themes, and 390px width.
6. Document non-obvious behavior here or in the component's props.

## Running it

```sh
bun run --cwd apps/design dev   # gallery at http://localhost:5173
bun run check                   # typecheck, unit tests, token lint
```

The UI package sits outside the app root, so `styles.css` declares
`@source "./**/*.{ts,tsx}"`. Without it, Tailwind will not generate classes that only appear in
`packages/ui`.

## Known limits

- No toast primitive yet.
- No density toggle. The compact scale is the only scale.
- No data table for cross-team views.
