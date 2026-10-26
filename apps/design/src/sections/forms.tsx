import { useState } from "react"
import {
  Block,
  Page,
  Panel,
  Row,
} from "../ui"
import {
  Button,
  CheckboxField,
  Select,
  SwitchField,
  Textarea,
  TextField,
} from "@workerbee/ui"

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Todo" },
  { value: "started", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Canceled" },
]

const PRIORITY_OPTIONS = [
  { value: "none", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

const ASSIGNEE_OPTIONS = [
  { value: "mason", label: "Mason Schafer" },
  { value: "atlas", label: "Atlas (agent)" },
  { value: "unassigned", label: "Unassigned" },
]

export function Forms() {
  const [status, setStatus] = useState("unstarted")
  const [priority, setPriority] = useState("high")
  const [assignee, setAssignee] = useState("mason")
  const [another, setAnother] = useState(false)
  const [subscribe, setSubscribe] = useState(true)

  return (
    <Page
      id="forms"
      eyebrow="Components"
      title="Forms"
      description="Labels sit above controls, hints and errors share one line of space, and every control is reachable by keyboard. Errors are announced, not just colored."
    >
      <Block title="Create issue" hint="A realistic form, not a gallery of loose inputs.">
        <Panel className="max-w-md">
          <div className="grid gap-3">
            <TextField
              label="Title"
              placeholder="Fix the sync gap after reconnect"
              defaultValue="Fix the sync gap after reconnect"
              description="Short and specific. The identifier is assigned by the team."
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label htmlFor="status" className="text-xs font-medium text-fg-muted">
                  Status
                </label>
                <Select
                  id="status"
                  options={STATUS_OPTIONS}
                  value={status}
                  onValueChange={setStatus}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="priority" className="text-xs font-medium text-fg-muted">
                  Priority
                </label>
                <Select
                  id="priority"
                  options={PRIORITY_OPTIONS}
                  value={priority}
                  onValueChange={setPriority}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="assignee" className="text-xs font-medium text-fg-muted">
                Assignee
              </label>
              <Select
                id="assignee"
                options={ASSIGNEE_OPTIONS}
                value={assignee}
                onValueChange={setAssignee}
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="description" className="text-xs font-medium text-fg-muted">
                Description
              </label>
              <Textarea
                id="description"
                rows={3}
                placeholder="What happened, and what should happen instead?"
              />
            </div>

            <CheckboxField
              id="create-another"
              label="Create another issue"
              checked={another}
              onCheckedChange={(value) => setAnother(value === true)}
            />

            <SwitchField
              id="subscribe"
              label="Subscribe to updates"
              description="Get an inbox notification for comments and state changes."
              checked={subscribe}
              onCheckedChange={setSubscribe}
            />

            <Row className="justify-end pt-1">
              <Button variant="ghost">Cancel</Button>
              <Button variant="primary">Create issue</Button>
            </Row>
          </div>
        </Panel>
      </Block>

      <Block title="States" hint="Error and disabled keep the same geometry, so a form does not jump.">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Panel>
            <TextField
              label="Workspace slug"
              defaultValue="Acme Team"
              error="Use lowercase letters, numbers, and single hyphens."
            />
          </Panel>
          <Panel>
            <TextField
              label="Agent budget"
              defaultValue="12000"
              disabled
              description="Only workspace owners can change the token budget."
            />
          </Panel>
          <Panel className="sm:col-span-2">
            <div className="grid gap-1.5">
              <label htmlFor="invalid-note" className="text-xs font-medium text-fg-muted">
                Comment
              </label>
              <Textarea id="invalid-note" invalid rows={2} defaultValue="" placeholder="Write a comment" />
              <p role="alert" className="text-xs text-danger">
                A comment needs at least one character.
              </p>
            </div>
          </Panel>
        </div>
      </Block>
    </Page>
  )
}
