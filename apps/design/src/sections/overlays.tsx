import { Copy, MoreHorizontal, Pencil, Trash2, UserRound } from "lucide-react"
import { useState } from "react"
import { Block, Page, Panel } from "../ui"
import {
  Button,
  Dialog,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  IconButton,
  Select,
  Tabs,
  TextField,
  Tooltip,
} from "@workerbee/ui"

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Todo" },
  { value: "started", label: "In progress" },
  { value: "done", label: "Done" },
]

export function Overlays() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Page
      id="overlays"
      eyebrow="Components"
      title="Overlays"
      description="Dialogs and menus trap focus, close on Escape, and return focus to the trigger. Shadows are used here and nowhere else."
    >
      <Block title="Dialog" hint="Use for a focused edit that should not navigate away.">
        <Panel>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            trigger={<Button variant="primary">Edit issue</Button>}
            title="Edit issue"
            description="Changes are written as one changeset and appear live for everyone."
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setDialogOpen(false)}>
                  Save changes
                </Button>
              </>
            }
          >
            <div className="grid gap-3">
              <TextField
                label="Title"
                defaultValue="Fix the sync gap after reconnect"
              />
              <div className="grid gap-1.5">
                <label htmlFor="dialog-status" className="text-xs font-medium text-fg-muted">
                  Status
                </label>
                <Select
                  id="dialog-status"
                  options={STATUS_OPTIONS}
                  defaultValue="unstarted"
                />
              </div>
            </div>
          </Dialog>
        </Panel>
      </Block>

      <Block title="Menu" hint="Destructive items are separated and labeled, never icon-only.">
        <Panel>
          <DropdownMenu
            trigger={
              <IconButton label="Issue actions" variant="secondary">
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </IconButton>
            }
          >
            <DropdownMenuLabel>Issue</DropdownMenuLabel>
            <DropdownMenuItem shortcut="E">
              <Pencil className="size-3.5 text-fg-subtle" aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UserRound className="size-3.5 text-fg-subtle" aria-hidden="true" />
              Assign to
            </DropdownMenuItem>
            <DropdownMenuItem shortcut="⌘D">
              <Copy className="size-3.5 text-fg-subtle" aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive>
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete issue
            </DropdownMenuItem>
          </DropdownMenu>
        </Panel>
      </Block>

      <Block title="Tooltip" hint="Supplements a visible label. It never replaces one.">
        <Panel>
          <Tooltip content="Sync paused. Last change was 4 minutes ago." side="right">
            <Button variant="secondary">Hover for detail</Button>
          </Tooltip>
        </Panel>
      </Block>

      <Block title="Tabs" hint="Underline for views, segmented for a small mode switch.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <Tabs
              items={[
                { value: "active", label: "Active", content: <p className="text-sm text-fg-muted">12 issues in progress across 3 teams.</p> },
                { value: "backlog", label: "Backlog", content: <p className="text-sm text-fg-muted">48 issues waiting for a cycle.</p> },
                { value: "done", label: "Done", content: <p className="text-sm text-fg-muted">31 issues closed this cycle.</p> },
              ]}
            />
          </Panel>
          <Panel>
            <Tabs
              variant="segmented"
              items={[
                { value: "list", label: "List", content: <p className="text-sm text-fg-muted">One row per issue, sorted by priority.</p> },
                { value: "board", label: "Board", content: <p className="text-sm text-fg-muted">One column per workflow state.</p> },
              ]}
            />
          </Panel>
        </div>
      </Block>
    </Page>
  )
}
