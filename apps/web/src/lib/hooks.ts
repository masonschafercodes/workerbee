import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "./api"
import type {
  CreateIssueBody,
  CreateLabelBody,
  Issue,
  UpdateIssueBody,
  UpdateLabelBody,
} from "./types"

export const keys = {
  workspaces: ["workspaces"] as const,
  bootstrap: (slug: string) => ["bootstrap", slug] as const,
  issue: (slug: string, id: string) => ["issue", slug, id] as const,
  comments: (slug: string, id: string) => ["comments", slug, id] as const,
}

export function useWorkspaces() {
  return useQuery({ queryKey: keys.workspaces, queryFn: api.workspaces })
}

export function useBootstrap(slug: string) {
  return useQuery({
    queryKey: keys.bootstrap(slug),
    queryFn: () => api.bootstrap(slug),
    // Realtime frames keep issues and comments current, so refetching the
    // whole snapshot on every navigation only adds latency. The workspaces
    // list stays on the default stale time because nothing pushes to it.
    staleTime: 300_000,
  })
}

export function useIssue(slug: string, id: string) {
  return useQuery({
    queryKey: keys.issue(slug, id),
    queryFn: () => api.issue(slug, id),
    enabled: id !== "",
  })
}

export function useComments(slug: string, id: string) {
  return useQuery({
    queryKey: keys.comments(slug, id),
    queryFn: () => api.comments(slug, id),
    enabled: id !== "",
  })
}

export function useCreateIssue(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CreateIssueBody) => api.createIssue(slug, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
    },
  })
}

export function useUpdateIssue(slug: string, id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateIssueBody) => api.updateIssue(slug, id, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: keys.issue(slug, id) })

      const previous = queryClient.getQueryData<Issue>(keys.issue(slug, id))

      if (previous !== undefined) {
        queryClient.setQueryData<Issue>(keys.issue(slug, id), {
          ...previous,
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.stateId !== undefined ? { stateId: body.stateId } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          version: previous.version + 1,
        })
      }

      return { previous }
    },
    onError: (_error, _body, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(keys.issue(slug, id), context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.issue(slug, id) })
      void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
    },
  })
}

export function useAddComment(slug: string, id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: string) => api.addComment(slug, id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.comments(slug, id) })
      void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
    },
  })
}

export function useCreateLabel(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CreateLabelBody) => api.createLabel(slug, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
    },
  })
}

export function useUpdateLabel(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { readonly id: string; readonly body: UpdateLabelBody }) =>
      api.updateLabel(slug, id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
      void queryClient.invalidateQueries({ queryKey: ["issue", slug] })
    },
  })
}

export function useDeleteLabel(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.deleteLabel(slug, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
      void queryClient.invalidateQueries({ queryKey: ["issue", slug] })
    },
  })
}

export function useAttachLabel(slug: string, issueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (labelId: string) => api.attachLabel(slug, issueId, labelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.issue(slug, issueId) })
      void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
    },
  })
}

export function useDetachLabel(slug: string, issueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (labelId: string) => api.detachLabel(slug, issueId, labelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.issue(slug, issueId) })
      void queryClient.invalidateQueries({ queryKey: keys.bootstrap(slug) })
    },
  })
}
