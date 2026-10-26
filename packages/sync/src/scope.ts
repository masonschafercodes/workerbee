import type { Change, Changeset } from "./changeset"

/**
 * "all" for an unrestricted actor. Otherwise the team ids the actor can read.
 * The realtime ticket carries this, and the hub uses it to filter fanout.
 */
export type TeamScope = readonly string[] | "all"

export function isVisible(change: Change, scope: TeamScope): boolean {
  if (change.teamId === null) {
    return true
  }

  return scope === "all" || scope.includes(change.teamId)
}

/**
 * Returns the changeset with only the changes the scope can read, or null when
 * the changeset contains no visible changes.
 */
export function visibleChanges(changeset: Changeset, scope: TeamScope): Changeset | null {
  const changes = changeset.changes.filter((change) => isVisible(change, scope))

  return changes.length === 0 ? null : { ...changeset, changes }
}
