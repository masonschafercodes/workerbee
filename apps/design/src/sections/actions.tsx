import { ChevronDown, MoreHorizontal, Plus, Search, Settings } from "lucide-react"
import { Block, Page, Panel, Row } from "../ui"
import { Button, IconButton, Kbd, Tooltip } from "@workerbee/ui"

export function Actions() {
  return (
    <Page
      id="actions"
      eyebrow="Components"
      title="Actions"
      description="One button hierarchy, three sizes. Primary is reserved for the main action in a view, and icon buttons always carry an accessible name."
    >
      <Block title="Variants" hint="Default to secondary. A screen usually has one primary action at most.">
        <Panel>
          <Row>
            <Button variant="primary">Create issue</Button>
            <Button variant="secondary">Filter</Button>
            <Button variant="ghost">Clear</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="link">View history</Button>
          </Row>
        </Panel>
      </Block>

      <Block title="Sizes" hint="Small sits in toolbars. Medium is the default. Large is for dialogs and empty states.">
        <Panel className="grid gap-4">
          <Row>
            <Button size="sm" variant="secondary">Small</Button>
            <Button size="md" variant="secondary">Medium</Button>
            <Button size="lg" variant="secondary">Large</Button>
          </Row>
          <Row>
            <Button size="sm" variant="primary">Small primary</Button>
            <Button size="md" variant="primary">Medium primary</Button>
            <Button size="lg" variant="primary">Large primary</Button>
          </Row>
        </Panel>
      </Block>

      <Block title="States" hint="Loading keeps the width stable. Disabled keeps its label and contrast.">
        <Panel>
          <Row>
            <Button variant="primary" loading>Saving</Button>
            <Button variant="secondary" loading>Syncing</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="secondary" leading={<Plus className="size-3.5" aria-hidden="true" />}>
              New issue
            </Button>
            <Button
              variant="secondary"
              trailing={<ChevronDown className="size-3.5" aria-hidden="true" />}
            >
              Status
            </Button>
          </Row>
        </Panel>
      </Block>

      <Block title="Icon buttons" hint="Every icon button needs a label, even when a tooltip also shows the text.">
        <Panel>
          <Row>
            <Tooltip content="Search">
              <IconButton label="Search">
                <Search className="size-4" aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content="More actions">
              <IconButton label="More actions">
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content="Workspace settings">
              <IconButton label="Workspace settings" variant="secondary">
                <Settings className="size-4" aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <IconButton label="Small icon button" size="sm">
              <Plus className="size-3.5" aria-hidden="true" />
            </IconButton>
          </Row>
        </Panel>
      </Block>

      <Block title="Keyboard" hint="Shortcuts sit next to the action they trigger.">
        <Panel>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              Search <Kbd>⌘</Kbd><Kbd>K</Kbd>
            </span>
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              Create issue <Kbd>C</Kbd>
            </span>
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              Go to team <Kbd>G</Kbd> then <Kbd>I</Kbd>
            </span>
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              Shortcuts <Kbd>?</Kbd>
            </span>
          </div>
        </Panel>
      </Block>
    </Page>
  )
}
