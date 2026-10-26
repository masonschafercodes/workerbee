import { useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Select,
  Skeleton,
  Textarea,
  Tooltip,
} from "@workerbee/ui"
import { relativeTime } from "../lib/format"
import { useAddComment, useBootstrap, useComments, useIssue, useUpdateIssue } from "../lib/hooks"
import type { WorkspaceSearch } from "../lib/search"
import type { Priority } from "../lib/types"

const PRIORITIES = [
  { value: "none", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export function IssuePage() {
  const { workspace, identifier } = useParams({ strict: false }) as {
    workspace: string
    identifier: string
  }
  const search = useSearch({ strict: false }) as WorkspaceSearch
  const navigate = useNavigate()
  const bootstrap = useBootstrap(workspace)
  const summary = bootstrap.data?.issues.find((issue) => issue.identifier === identifier)
  const issue = useIssue(workspace, summary?.id ?? "")
  const comments = useComments(workspace, summary?.id ?? "")
  const update = useUpdateIssue(workspace, summary?.id ?? "")
  const addComment = useAddComment(workspace, summary?.id ?? "")
  const [comment, setComment] = useState("")

  function close() {
    void navigate({
      to: "/w/$workspace",
      params: { workspace },
      search,
    })
  }

  if (summary === undefined) {
    return (
      <aside className="fixed inset-0 z-30 flex flex-col bg-canvas lg:static lg:z-auto lg:w-[26rem] lg:shrink-0 lg:border-l lg:border-line">
        <div className="flex h-12 items-center gap-2 border-b border-line px-3">
          <IconButton label="Close issue" size="sm" onClick={close}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </IconButton>
          <span className="font-mono text-xs text-fg-subtle">{identifier}</span>
        </div>
        <div className="grid place-items-center gap-2 p-8 text-center">
          <p className="text-sm font-medium text-fg">Issue not found</p>
          <p className="text-xs text-fg-muted">
            It may have been deleted, or the link is from another workspace.
          </p>
        </div>
      </aside>
    )
  }

  const state = bootstrap.data?.states.find((item) => item.id === summary.stateId)
  const states = (bootstrap.data?.states ?? [])
    .filter((item) => item.teamId === summary.teamId)
    .sort((a, b) => a.position - b.position)

  return (
    <aside className="fixed inset-0 z-30 flex flex-col overflow-y-auto border-l border-line bg-canvas lg:static lg:z-auto lg:w-[26rem] lg:shrink-0">
      <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-canvas px-3">
        <Tooltip content="Close">
          <IconButton label="Close issue" size="sm" onClick={close}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </IconButton>
        </Tooltip>
        <span className="font-mono text-xs text-fg-subtle">{summary.identifier}</span>
        {state !== undefined ? <Badge className="ml-auto">{state.name}</Badge> : null}
      </div>

      <div className="grid gap-5 p-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-medium leading-6 text-fg">
            {issue.data?.title ?? summary.title}
          </h2>
          <p className="text-2xs text-fg-subtle">
            Updated {relativeTime(issue.data?.updatedAt ?? summary.updatedAt)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="issue-state" className="text-xs font-medium text-fg-muted">
              State
            </label>
            <Select
              id="issue-state"
              options={states.map((item) => ({ value: item.id, label: item.name }))}
              value={issue.data?.stateId ?? summary.stateId}
              disabled={issue.data === undefined || update.isPending}
              onValueChange={(value) => {
                if (issue.data !== undefined) {
                  update.mutate({ stateId: value, version: issue.data.version })
                }
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="issue-priority" className="text-xs font-medium text-fg-muted">
              Priority
            </label>
            <Select
              id="issue-priority"
              options={PRIORITIES}
              value={issue.data?.priority ?? summary.priority}
              disabled={issue.data === undefined || update.isPending}
              onValueChange={(value) => {
                if (issue.data !== undefined) {
                  update.mutate({
                    priority: value as Priority,
                    version: issue.data.version,
                  })
                }
              }}
            />
          </div>
        </div>

        {update.error !== null ? (
          <p role="alert" className="text-xs text-danger">
            {update.error.message}
          </p>
        ) : null}

        <section className="grid gap-1.5">
          <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-fg-subtle">
            Description
          </h3>
          {issue.isError ? (
            <div className="grid gap-2">
              <p role="alert" className="text-xs text-danger">
                {issue.error.message}
              </p>
              <div>
                <Button size="sm" variant="secondary" onClick={() => void issue.refetch()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : issue.isPending ? (
            <div className="grid gap-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-fg-muted">
              {issue.data?.description !== undefined && issue.data.description !== ""
                ? issue.data.description
                : "No description."}
            </p>
          )}
        </section>

        <section className="grid gap-3 border-t border-line-subtle pt-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-fg-subtle">
            Comments
          </h3>

          {comments.isError ? (
            <div className="grid gap-2">
              <p role="alert" className="text-xs text-danger">
                {comments.error.message}
              </p>
              <div>
                <Button size="sm" variant="secondary" onClick={() => void comments.refetch()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : comments.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : (comments.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-fg-muted">No comments yet.</p>
          ) : (
            <ul className="grid gap-4">
              {comments.data?.map((item) => (
                <li key={item.id} className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <Avatar name={item.authorName ?? "Unknown"} size="sm" />
                    <span className="text-xs font-medium text-fg">
                      {item.authorName ?? "Unknown"}
                    </span>
                    <span className="text-2xs text-fg-subtle">
                      {relativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap pl-8 text-sm text-fg-muted">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2">
            <Textarea
              aria-label="New comment"
              rows={3}
              placeholder="Leave a comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault()

                  if (comment.trim() !== "" && !addComment.isPending) {
                    addComment.mutate(comment.trim(), {
                      onSuccess: () => setComment(""),
                    })
                  }
                }
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <span className="text-2xs text-fg-subtle">⌘ Enter to send</span>
              <Button
                size="sm"
                variant="primary"
                loading={addComment.isPending}
                disabled={comment.trim() === ""}
                onClick={() => {
                  addComment.mutate(comment.trim(), {
                    onSuccess: () => setComment(""),
                  })
                }}
              >
                Comment
              </Button>
            </div>
            {addComment.error !== null ? (
              <p role="alert" className="text-xs text-danger">
                {addComment.error.message}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </aside>
  )
}
