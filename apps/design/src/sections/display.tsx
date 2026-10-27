import { Bot, Hash, Inbox, Layers, UserRound } from "lucide-react"
import { Block, Page, Panel } from "../ui"
import { Avatar, Badge, Kbd, LabelChip, Separator, Skeleton } from "@workerbee/ui"

const LABEL_EXAMPLES = [
  { name: "bug", color: "#d73a4a", scope: "workspace" as const },
  { name: "design", color: "#8250df", scope: "team" as const },
  { name: "needs reproduction", color: "#bf8700", scope: "workspace" as const },
  { name: "a label name that is long enough to truncate", color: "#0969da", scope: "team" as const },
]

export function Display() {
  return (
    <Page
      id="display"
      eyebrow="Components"
      title="Data display"
      description="Small, dense pieces that carry identity and state. Avatars distinguish people from agents by shape as well as color."
    >
      <Block title="Badges" hint="Short labels, not sentences. One line, no wrapping.">
        <Panel>
          <div className="flex flex-wrap items-center gap-4">
            <Badge>Backlog</Badge>
            <Badge variant="accent">Agent</Badge>
            <Badge variant="success">Done</Badge>
            <Badge variant="warning">In progress</Badge>
            <Badge variant="danger">Blocked</Badge>
            <Badge variant="outline">Triage</Badge>
            <Badge variant="neutral" size="md">Cycle 14</Badge>
          </div>
        </Panel>
      </Block>

      <Block
        title="Label chips"
        hint="The fill is the label's own color. Circle means workspace scope, square means team scope, and the name always carries the meaning."
      >
        <Panel>
          <div className="flex flex-wrap items-center gap-2">
            {LABEL_EXAMPLES.map((label) => (
              <LabelChip key={label.name} {...label} />
            ))}
          </div>
        </Panel>
      </Block>

      <Block title="Avatars" hint="Circle for a person, rounded square for an agent. Initials when there is no image.">
        <Panel>
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex items-end gap-2">
              <Avatar name="Mason Schafer" size="xs" />
              <Avatar name="Mason Schafer" size="sm" />
              <Avatar name="Mason Schafer" size="md" />
            </div>
            <div className="flex items-end gap-2">
              <Avatar name="Atlas" kind="agent" size="xs" />
              <Avatar name="Atlas" kind="agent" size="sm" />
              <Avatar name="Atlas" kind="agent" size="md" />
            </div>
            <div className="flex items-center gap-2 text-xs text-fg-subtle">
              <UserRound className="size-3.5" aria-hidden="true" /> person
              <Bot className="size-3.5" aria-hidden="true" /> agent
            </div>
          </div>
        </Panel>
      </Block>

      <Block title="Keys and identifiers" hint="Mono for anything a person might type or copy.">
        <Panel>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="flex items-center gap-1 text-sm text-fg-muted">
              Open search <Kbd>⌘</Kbd><Kbd>K</Kbd>
            </span>
            <span className="flex items-center gap-1 text-sm text-fg-muted">
              New issue <Kbd>C</Kbd>
            </span>
            <span className="flex items-center gap-1 text-sm text-fg-muted">
              <Hash className="size-3.5 text-fg-subtle" aria-hidden="true" />
              <span className="font-mono text-xs">ENG-412</span>
            </span>
            <span className="flex items-center gap-1 text-sm text-fg-muted">
              <Layers className="size-3.5 text-fg-subtle" aria-hidden="true" />
              <span className="font-mono text-xs">seq 4821</span>
            </span>
          </div>
        </Panel>
      </Block>

      <Block title="Loading and empty states" hint="Skeletons keep the list shape. Empty states say what happened and what to do next.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="grid gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex min-w-0 items-center gap-2">
                <Skeleton className="size-3.5 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-14 shrink-0" />
                <Skeleton className="h-3 min-w-0 flex-1" />
                <Skeleton className="size-6 shrink-0 rounded-full" />
              </div>
            ))}
          </Panel>

          <div className="grid place-items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface px-6 py-8 text-center">
            <Inbox className="size-5 text-fg-subtle" aria-hidden="true" />
            <p className="text-sm font-medium text-fg">No issues match this view</p>
            <p className="max-w-xs text-xs text-fg-muted">
              Clear a filter or widen the team scope. New issues appear here as soon as they are
              created.
            </p>
          </div>
        </div>
      </Block>

      <Block title="Separator">
        <Panel className="grid gap-3">
          <p className="text-sm text-fg-muted">Above the line</p>
          <Separator />
          <p className="text-sm text-fg-muted">Below the line</p>
        </Panel>
      </Block>
    </Page>
  )
}
