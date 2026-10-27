import type { Changeset, Change } from "@workerbee/realtime"
import {
  issueSchema,
  issueSummarySchema,
  labelSchema,
  type Bootstrap,
  type Issue,
  type IssueSummary,
  type Label,
} from "./types"

export type CacheApplyOutcome =
  | { readonly kind: "duplicate"; readonly bootstrap: Bootstrap }
  | { readonly kind: "gap"; readonly bootstrap: Bootstrap }
  | {
      readonly kind: "applied"
      readonly bootstrap: Bootstrap
      readonly refreshBootstrap: boolean
    }

function compareIssues(left: IssueSummary, right: IssueSummary): number {
  const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt)

  if (updatedAtOrder !== 0) {
    return updatedAtOrder
  }

  if (left.identifier < right.identifier) {
    return -1
  }

  return left.identifier > right.identifier ? 1 : 0
}

function applyIssue(
  issues: readonly IssueSummary[],
  change: Change,
): { readonly issues: readonly IssueSummary[]; readonly refresh: boolean } {
  const index = issues.findIndex((issue) => issue.id === change.id)

  if (change.op === "delete") {
    return {
      issues: index < 0 ? issues : issues.filter((issue) => issue.id !== change.id),
      refresh: false,
    }
  }

  if (index < 0 && change.op === "update") {
    return { issues, refresh: true }
  }

  const previous = index < 0 ? {} : issues[index]
  const candidate = issueSummarySchema.safeParse({
    ...previous,
    ...change.patch,
    id: change.id,
    ...(change.teamId !== null ? { teamId: change.teamId } : {}),
  })

  if (!candidate.success) {
    return { issues, refresh: true }
  }

  const next = [...issues]

  if (index < 0) {
    next.push(candidate.data)
  } else {
    next[index] = candidate.data
  }

  return { issues: next.sort(compareIssues), refresh: false }
}

export function applyIssueDetailChange(current: Issue, change: Change): Issue | null {
  if (change.entity !== "issue" || change.op === "delete") {
    return null
  }

  const parsed = issueSchema.safeParse({ ...current, ...change.patch })

  return parsed.success ? parsed.data : null
}

function applyLabel(
  labels: readonly Label[],
  change: Change,
): { readonly labels: readonly Label[]; readonly refresh: boolean } {
  const index = labels.findIndex((label) => label.id === change.id)

  if (change.op === "delete") {
    return {
      labels: index < 0 ? labels : labels.filter((label) => label.id !== change.id),
      refresh: false,
    }
  }

  if (index < 0 && change.op === "update") {
    return { labels, refresh: true }
  }

  const previous = index < 0 ? {} : labels[index]
  const candidate = labelSchema.safeParse({
    ...previous,
    ...change.patch,
    id: change.id,
    teamId: change.teamId,
  })

  if (!candidate.success) {
    return { labels, refresh: true }
  }

  const next = [...labels]

  if (index < 0) {
    next.push(candidate.data)
  } else {
    next[index] = candidate.data
  }

  next.sort((left, right) => {
    if (left.teamId !== null && right.teamId === null) {
      return 1
    }

    if (left.teamId === null && right.teamId !== null) {
      return -1
    }

    return left.name.localeCompare(right.name)
  })

  return { labels: next, refresh: false }
}

export function applyChangesetToBootstrap(
  bootstrap: Bootstrap,
  changeset: Changeset,
): CacheApplyOutcome {
  if (changeset.seq <= bootstrap.seq) {
    return { kind: "duplicate", bootstrap }
  }

  if (changeset.seq !== bootstrap.seq + 1) {
    return { kind: "gap", bootstrap }
  }

  let issues: readonly IssueSummary[] = bootstrap.issues
  let labels: readonly Label[] = bootstrap.labels
  let refreshBootstrap = false

  for (const change of changeset.changes) {
    if (change.entity === "issue") {
      const result = applyIssue(issues, change)
      issues = result.issues
      refreshBootstrap ||= result.refresh
    } else if (change.entity === "label") {
      const result = applyLabel(labels, change)
      labels = result.labels
      refreshBootstrap ||= result.refresh
    } else if (change.entity !== "comment") {
      refreshBootstrap = true
    }
  }

  return {
    kind: "applied",
    bootstrap: {
      ...bootstrap,
      seq: changeset.seq,
      issues: [...issues],
      labels: [...labels],
    },
    refreshBootstrap,
  }
}
