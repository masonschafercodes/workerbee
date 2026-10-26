import { useEffect, useState } from "react"
import {
  Button,
  Dialog,
  Select,
  Textarea,
  TextField,
} from "@workerbee/ui"
import { useCreateIssue } from "../lib/hooks"
import type { Bootstrap, Issue } from "../lib/types"

function defaultStateId(bootstrap: Bootstrap, teamId: string): string {
  const states = bootstrap.states
    .filter((state) => state.teamId === teamId)
    .sort((a, b) => a.position - b.position)

  return (states.find((state) => state.category === "unstarted") ?? states[0])?.id ?? ""
}

export type CreateIssueDialogProps = {
  readonly slug: string
  readonly bootstrap: Bootstrap
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onCreated: (issue: Issue) => void
}

export function CreateIssueDialog({
  slug,
  bootstrap,
  open,
  onOpenChange,
  onCreated,
}: CreateIssueDialogProps) {
  const firstTeamId = bootstrap.teams[0]?.id ?? ""
  const [teamId, setTeamId] = useState(firstTeamId)
  const [stateId, setStateId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const create = useCreateIssue(slug)

  useEffect(() => {
    if (!open) {
      return
    }

    setTeamId(firstTeamId)
    setStateId(defaultStateId(bootstrap, firstTeamId))
    setTitle("")
    setDescription("")
    setError(null)
  }, [open, bootstrap, firstTeamId])

  const states = bootstrap.states
    .filter((state) => state.teamId === teamId)
    .sort((a, b) => a.position - b.position)

  function submit() {
    if (title.trim() === "" || teamId === "" || stateId === "") {
      setError("Add a title and choose a team and state.")
      return
    }

    create.mutate(
      {
        teamId,
        stateId,
        title: title.trim(),
        ...(description.trim() !== "" ? { description } : {}),
      },
      {
        onSuccess: ({ issue }) => {
          onOpenChange(false)
          onCreated(issue)
        },
        onError: (mutationError) => {
          setError(mutationError.message)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New issue"
      description="Give it a short title. You can add detail after it exists."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            Create issue
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <TextField
          label="Title"
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Fix the sync gap after reconnect"
          {...(error !== null ? { error } : {})}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="create-team" className="text-xs font-medium text-fg-muted">
              Team
            </label>
            <Select
              id="create-team"
              options={bootstrap.teams.map((team) => ({
                value: team.id,
                label: `${team.key} · ${team.name}`,
              }))}
              value={teamId}
              onValueChange={(value) => {
                setTeamId(value)
                setStateId(defaultStateId(bootstrap, value))
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="create-state" className="text-xs font-medium text-fg-muted">
              State
            </label>
            <Select
              id="create-state"
              options={states.map((state) => ({ value: state.id, label: state.name }))}
              value={stateId}
              onValueChange={setStateId}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="create-description" className="text-xs font-medium text-fg-muted">
            Description
          </label>
          <Textarea
            id="create-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What should happen?"
          />
        </div>
      </div>
    </Dialog>
  )
}
