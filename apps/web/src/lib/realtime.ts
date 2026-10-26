import { parseHubFrame } from "@workerbee/realtime"
import type { Changeset, Change } from "@workerbee/realtime"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "./api"
import { keys } from "./hooks"
import { applyChangesetToBootstrap } from "./realtime-cache"
import { commentSchema, issueSchema, type Bootstrap, type Comment, type Issue } from "./types"

const INITIAL_RECONNECT_MS = 500
const MAX_RECONNECT_MS = 30_000
const STABLE_CONNECTION_MS = 10_000

function websocketUrl(workspaceId: string, ticket: string, since: number): string {
  const url = new URL(`/api/v1/realtime/${workspaceId}`, window.location.origin)
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  url.searchParams.set("ticket", ticket)
  url.searchParams.set("since", String(since))

  return url.toString()
}

export function useRealtime(slug: string, ready: boolean): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ready) {
      return
    }

    let stopped = false
    let socket: WebSocket | null = null
    let retryTimer: number | null = null
    let retryDelay = INITIAL_RECONNECT_MS
    let openedAt = 0
    let processing = Promise.resolve()

    async function resetFromBootstrap(): Promise<void> {
      const bootstrap = await api.bootstrap(slug)

      if (stopped) {
        return
      }

      queryClient.setQueryData(keys.bootstrap(slug), bootstrap)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["issue", slug] }),
        queryClient.invalidateQueries({ queryKey: ["comments", slug] }),
      ])
    }

    function updateIssueDetail(change: Change): void {
      if (change.entity !== "issue") {
        return
      }

      const key = keys.issue(slug, change.id)
      const current = queryClient.getQueryData<Issue>(key)

      if (change.op === "delete") {
        void queryClient.invalidateQueries({ queryKey: key })
      } else if (current !== undefined) {
        const parsed = issueSchema.safeParse({ ...current, ...change.patch })

        if (parsed.success) {
          queryClient.setQueryData(key, parsed.data)
        } else {
          void queryClient.invalidateQueries({ queryKey: key })
        }
      }
    }

    function updateComments(change: Change): void {
      if (change.entity !== "comment") {
        return
      }

      const issueId = change.patch.issueId

      if (typeof issueId !== "string") {
        return
      }

      const key = keys.comments(slug, issueId)
      const current = queryClient.getQueryData<Comment[]>(key)

      if (current === undefined) {
        return
      }

      if (change.op === "delete") {
        queryClient.setQueryData(
          key,
          current.filter((comment) => comment.id !== change.id),
        )
        return
      }

      const previous = current.find((comment) => comment.id === change.id)
      const authorId = change.patch.authorId
      const members = queryClient.getQueryData<Bootstrap>(keys.bootstrap(slug))?.members ?? []
      const author = members.find((member) => member.actorId === authorId)
      const parsed = commentSchema.safeParse({
        ...previous,
        ...change.patch,
        id: change.id,
        authorName: previous?.authorName ?? author?.name ?? null,
        editedAt: previous?.editedAt ?? null,
      })

      if (!parsed.success) {
        void queryClient.invalidateQueries({ queryKey: key })
        return
      }

      const next = current.filter((comment) => comment.id !== change.id)
      next.push(parsed.data)
      next.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      queryClient.setQueryData(key, next)
    }

    function updateEntityCaches(changeset: Changeset): void {
      for (const change of changeset.changes) {
        updateIssueDetail(change)
        updateComments(change)
      }
    }

    function applyChangeset(changeset: Changeset): boolean {
      const current = queryClient.getQueryData<Bootstrap>(keys.bootstrap(slug))

      if (current === undefined) {
        return false
      }

      const outcome = applyChangesetToBootstrap(current, changeset)

      if (outcome.kind === "gap") {
        return false
      }

      if (outcome.kind === "duplicate") {
        return true
      }

      queryClient.setQueryData(keys.bootstrap(slug), outcome.bootstrap)
      updateEntityCaches(changeset)

      if (outcome.refreshBootstrap) {
        void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
      }

      return true
    }

    async function catchUp(throughSeq: number): Promise<boolean> {
      for (let page = 0; page < 10; page += 1) {
        const current = queryClient.getQueryData<Bootstrap>(keys.bootstrap(slug))

        if (current === undefined) {
          return false
        }

        const changesets = await api.sync(slug, current.seq)

        if (changesets.length === 0) {
          return current.seq >= throughSeq
        }

        for (const changeset of changesets) {
          if (!applyChangeset(changeset)) {
            return false
          }
        }

        if (changesets.length < 500) {
          const latest = queryClient.getQueryData<Bootstrap>(keys.bootstrap(slug))

          return latest !== undefined && latest.seq >= throughSeq
        }
      }

      const latest = queryClient.getQueryData<Bootstrap>(keys.bootstrap(slug))

      return latest !== undefined && latest.seq >= throughSeq
    }

    async function handleFrame(value: unknown): Promise<void> {
      const frame = parseHubFrame(value)

      if (frame.type === "reset") {
        await resetFromBootstrap()
        return
      }

      const current = queryClient.getQueryData<Bootstrap>(keys.bootstrap(slug))

      if (current === undefined || frame.changeset.seq <= current.seq) {
        return
      }

      if (frame.changeset.seq !== current.seq + 1) {
        if (await catchUp(frame.changeset.seq)) {
          return
        }

        await resetFromBootstrap()
        return
      }

      if (!applyChangeset(frame.changeset)) {
        await resetFromBootstrap()
      }
    }

    function scheduleReconnect(): void {
      if (stopped || retryTimer !== null) {
        return
      }

      const wasStable = openedAt > 0 && Date.now() - openedAt >= STABLE_CONNECTION_MS
      openedAt = 0

      if (wasStable) {
        retryDelay = INITIAL_RECONNECT_MS
      }

      const delay = Math.round(retryDelay * (0.8 + Math.random() * 0.4))
      retryDelay = Math.min(retryDelay * 2, MAX_RECONNECT_MS)
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        void connect()
      }, delay)
    }

    async function connect(): Promise<void> {
      if (stopped) {
        return
      }

      try {
        const current = queryClient.getQueryData<Bootstrap>(keys.bootstrap(slug))

        if (current === undefined) {
          scheduleReconnect()
          return
        }

        const { ticket } = await api.realtimeTicket(slug)

        if (stopped) {
          return
        }

        const next = new WebSocket(websocketUrl(current.workspace.id, ticket, current.seq))
        socket = next

        next.onopen = () => {
          openedAt = Date.now()
        }
        next.onmessage = (event) => {
          processing = processing
            .then(() => {
              const value: unknown = JSON.parse(String(event.data))

              return handleFrame(value)
            })
            .catch(() => next.close(1011, "Could not apply live update"))
        }
        next.onerror = () => next.close()
        next.onclose = () => {
          if (socket === next) {
            socket = null
          }

          scheduleReconnect()
        }
      } catch {
        scheduleReconnect()
      }
    }

    void connect()

    return () => {
      stopped = true

      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
      }

      socket?.close(1000, "Workspace changed")
    }
  }, [queryClient, ready, slug])
}
