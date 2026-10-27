import { useParams } from "@tanstack/react-router"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import {
  Button,
  Dialog,
  LabelChip,
  Select,
  TextField,
} from "@workerbee/ui"
import {
  useBootstrap,
  useCreateLabel,
  useDeleteLabel,
  useUpdateLabel,
  useWorkspaces,
} from "../lib/hooks"
import type { Label } from "../lib/types"

const DEFAULT_COLOR = "#d73a4a"
const WORKSPACE_SCOPE = "workspace"

export function SettingsLabelsPage() {
  const { workspace: slug } = useParams({ strict: false }) as { workspace: string }
  const bootstrap = useBootstrap(slug)
  const workspaces = useWorkspaces()
  const role = workspaces.data?.find((workspace) => workspace.slug === slug)?.role
  const canManage = role === "owner" || role === "admin"
  const create = useCreateLabel(slug)
  const update = useUpdateLabel(slug)
  const remove = useDeleteLabel(slug)

  const [name, setName] = useState("")
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [teamId, setTeamId] = useState(WORKSPACE_SCOPE)
  const [formError, setFormError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Label | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState(DEFAULT_COLOR)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState<Label | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (bootstrap.isPending) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8">
        <p className="text-sm text-fg-muted">Loading labels...</p>
      </div>
    )
  }

  if (bootstrap.isError) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center gap-2 p-8 text-center">
        <p role="alert" className="text-sm text-danger">
          {bootstrap.error.message}
        </p>
        <Button size="sm" variant="secondary" onClick={() => void bootstrap.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const labels = bootstrap.data.labels
  const teams = bootstrap.data.teams
  const teamOptions = [
    { value: WORKSPACE_SCOPE, label: "Workspace" },
    ...teams.map((team) => ({ value: team.id, label: `${team.key} · ${team.name}` })),
  ]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    create.mutate(
      {
        name,
        color,
        ...(teamId !== WORKSPACE_SCOPE ? { teamId } : {}),
      },
      {
        onSuccess: () => {
          setName("")
          setColor(DEFAULT_COLOR)
          setTeamId(WORKSPACE_SCOPE)
        },
        onError: (error) => setFormError(error.message),
      },
    )
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (editing === null) {
      return
    }

    setEditError(null)

    update.mutate(
      { id: editing.id, body: { name: editName, color: editColor } },
      {
        onSuccess: () => setEditing(null),
        onError: (error) => setEditError(error.message),
      },
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-3xl gap-8 p-6 lg:p-8">
        <header className="grid gap-1.5">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-fg">Labels</h1>
          <p className="max-w-2xl text-sm text-fg-muted">
            A workspace label is available to every team. A team label only applies to that
            team&apos;s issues. Names are unique within their scope and case-insensitive.
          </p>
        </header>

        {canManage ? (
          <form onSubmit={submit} className="grid gap-3 rounded-md border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem_12rem_auto] sm:items-end">
              <TextField
                label="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="bug"
                maxLength={40}
                required
              />
              <TextField
                label="Color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#d73a4a"
                required
              />
              <div className="grid gap-1.5">
                <label htmlFor="label-scope" className="text-xs font-medium text-fg-muted">
                  Scope
                </label>
                <Select
                  id="label-scope"
                  options={teamOptions}
                  value={teamId}
                  onValueChange={setTeamId}
                />
              </div>
              <Button type="submit" variant="primary" loading={create.isPending}>
                <Plus className="size-3.5" aria-hidden="true" />
                Create
              </Button>
            </div>
            {name.trim() === "" ? null : (
              <div className="flex items-center gap-2 text-xs text-fg-subtle">
                Preview
                <LabelChip
                  name={name.trim()}
                  color={color}
                  scope={teamId === WORKSPACE_SCOPE ? "workspace" : "team"}
                />
              </div>
            )}
            {formError !== null ? (
              <p role="alert" className="text-xs text-danger">
                {formError}
              </p>
            ) : null}
          </form>
        ) : null}

        <section className="grid gap-3">
          <h2 className="text-sm font-medium text-fg">All labels</h2>

          {labels.length === 0 ? (
            <div className="rounded-md border border-line bg-surface p-6 text-center">
              <p className="text-sm font-medium text-fg">No labels yet</p>
              <p className="mt-1 text-xs text-fg-muted">
                Create one above and it becomes available on issues immediately.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2">
              {labels.map((label) => {
                const team = teams.find((item) => item.id === label.teamId)

                return (
                  <li
                    key={label.id}
                    className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2"
                  >
                    <LabelChip
                      name={label.name}
                      color={label.color}
                      scope={label.teamId === null ? "workspace" : "team"}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle">
                      {label.teamId === null ? "Workspace" : `${team?.key ?? "Team"} · ${team?.name ?? "Unknown team"}`}
                    </span>
                    <span className="font-mono text-2xs text-fg-subtle">{label.color}</span>
                    {canManage ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(label)
                            setEditName(label.name)
                            setEditColor(label.color)
                            setEditError(null)
                          }}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeleting(label)
                            setDeleteError(null)
                          }}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
        title="Edit label"
        description="Changing a name or color updates every issue that uses it."
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              form="edit-label"
              loading={update.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <form id="edit-label" onSubmit={submitEdit} className="grid gap-3">
          <TextField
            label="Name"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            maxLength={40}
            required
          />
          <TextField
            label="Color"
            value={editColor}
            onChange={(event) => setEditColor(event.target.value)}
            placeholder="#d73a4a"
            required
          />
          {editError !== null ? (
            <p role="alert" className="text-xs text-danger">
              {editError}
            </p>
          ) : null}
        </form>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
          }
        }}
        title="Delete label"
        description="This removes the label from every issue that uses it. The issues themselves stay."
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (deleting === null) {
                  return
                }

                remove.mutate(deleting.id, {
                  onSuccess: () => setDeleting(null),
                  onError: (error) => setDeleteError(error.message),
                })
              }}
            >
              Delete label
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          Delete <span className="font-medium text-fg">{deleting?.name}</span>?
        </p>
        {deleteError !== null ? (
          <p role="alert" className="mt-2 text-xs text-danger">
            {deleteError}
          </p>
        ) : null}
      </Dialog>
    </div>
  )
}
