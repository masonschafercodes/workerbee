import { ChevronDown, Inbox, LayoutList, Search, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { Block, Page } from "../ui"
import {
  Badge,
  Button,
  IconButton,
  Input,
  IssueRow,
  Tabs,
  type IssueRowProps,
} from "@workerbee/ui"

const ISSUES: readonly IssueRowProps[] = [
  {
    identifier: "ENG-412",
    title: "Assign the workspace seq inside the write transaction",
    status: "started",
    priority: "high",
    assignee: { name: "Mason Schafer" },
    meta: "2h",
  },
  {
    identifier: "ENG-409",
    title: "Replay buffered changesets after a reconnect",
    status: "unstarted",
    priority: "urgent",
    assignee: { name: "Atlas", kind: "agent" },
    meta: "4h",
  },
  {
    identifier: "ENG-401",
    title: "Budget the agent tool surface per run",
    status: "backlog",
    priority: "medium",
    meta: "1d",
  },
  {
    identifier: "OPS-118",
    title: "Archive changesets older than seven days",
    status: "started",
    priority: "medium",
    assignee: { name: "Atlas", kind: "agent" },
    meta: "1d",
  },
  {
    identifier: "ENG-388",
    title: "Prefix matching for issue identifiers in search",
    status: "done",
    priority: "low",
    assignee: { name: "Mason Schafer" },
    meta: "3d",
  },
  {
    identifier: "OPS-96",
    title: "Checksum attachments before upload",
    status: "canceled",
    priority: "none",
    meta: "1w",
  },
]

export function Patterns() {
  const [selected, setSelected] = useState(ISSUES[0]?.identifier ?? "")

  return (
    <Page
      id="patterns"
      eyebrow="Patterns"
      title="Issue list"
      description="The densest surface in the product. A row is one button: 36 pixels tall, one border, and no nested controls. Metadata is truncated before the title is."
    >
      <Block title="Toolbar and list" hint="Filters live on one line. The list keeps its shape while filtering.">
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-2">
            <div className="relative w-full max-w-56">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
                aria-hidden="true"
              />
              <Input
                aria-label="Search issues"
                placeholder="Search issues"
                className="h-7 pl-7 text-xs"
              />
            </div>

            <Button size="sm" variant="secondary" trailing={<ChevronDown className="size-3" aria-hidden="true" />}>
              Status
            </Button>
            <Button size="sm" variant="secondary" trailing={<ChevronDown className="size-3" aria-hidden="true" />}>
              Assignee
            </Button>
            <Button size="sm" variant="secondary" trailing={<ChevronDown className="size-3" aria-hidden="true" />}>
              Priority
            </Button>

            <div className="ml-auto flex items-center gap-1">
              <IconButton label="Filter options" size="sm">
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              </IconButton>
              <IconButton label="Layout" size="sm">
                <LayoutList className="size-3.5" aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-line-subtle px-2 py-2">
            <h3 className="text-sm font-medium text-fg">Engineering</h3>
            <Badge>{ISSUES.length} issues</Badge>
            <span className="ml-auto text-2xs text-fg-subtle">Grouped by status</span>
          </div>

          <ul aria-label="Engineering issues">
            {ISSUES.map((issue) => (
              <li key={issue.identifier}>
                <IssueRow
                  {...issue}
                  selected={selected === issue.identifier}
                  onClick={() => setSelected(issue.identifier)}
                />
              </li>
            ))}
          </ul>
        </div>
      </Block>

      <Block title="View switch" hint="Segmented controls switch the shape of the same data.">
        <Tabs
          variant="segmented"
          items={[
            { value: "list", label: "List" },
            { value: "board", label: "Board" },
            { value: "timeline", label: "Timeline" },
          ]}
        />
      </Block>

      <Block title="Empty view" hint="Name the state and the next action. No illustration.">
        <div className="grid place-items-center gap-3 rounded-md border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <Inbox className="size-6 text-fg-subtle" aria-hidden="true" />
          <div className="grid gap-1">
            <p className="text-sm font-medium text-fg">No issues in this cycle</p>
            <p className="max-w-sm text-xs text-fg-muted">
              Pull work from the backlog, or create an issue and assign it to Mason or Atlas.
            </p>
          </div>
          <Button size="sm" variant="primary">
            Create issue
          </Button>
        </div>
      </Block>
    </Page>
  )
}
