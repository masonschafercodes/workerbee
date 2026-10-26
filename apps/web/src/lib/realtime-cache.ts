import type { Changeset, Change } from "@workerbee/realtime"
import { issueSummarySchema, type Bootstrap, type IssueSummary } from "./types"

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
  let refreshBootstrap = false

  for (const change of changeset.changes) {
    if (change.entity === "issue") {
      const result = applyIssue(issues, change)
      issues = result.issues
      refreshBootstrap ||= result.refresh
    } else if (change.entity !== "comment") {
      refreshBootstrap = true
    }
  }

  return {
    kind: "applied",
    bootstrap: { ...bootstrap, seq: changeset.seq, issues: [...issues] },
    refreshBootstrap,
  }
}
