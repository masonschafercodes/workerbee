import type { TeamId } from "./ids"

export const LABEL_NAME_MAX_LENGTH = 40

const LABEL_NAME_CONTROL = /[\u0000-\u001f\u007f]/
const LABEL_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * Labels are either workspace-wide or owned by one team. A team label can only
 * be attached to that team's issues; a workspace label can be attached anywhere.
 */
export type LabelScope =
  | { readonly kind: "workspace" }
  | { readonly kind: "team"; readonly teamId: TeamId }

export class InvalidLabelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidLabelError"
  }
}

export function labelName(value: string): string {
  const name = value.trim()

  if (name === "") {
    throw new InvalidLabelError("a label name needs at least one character")
  }

  if (name.length > LABEL_NAME_MAX_LENGTH) {
    throw new InvalidLabelError(
      `a label name can be at most ${LABEL_NAME_MAX_LENGTH} characters`,
    )
  }

  if (LABEL_NAME_CONTROL.test(name)) {
    throw new InvalidLabelError("a label name cannot contain control characters")
  }

  return name
}

/**
 * Six-digit hex is the stored form. Normalizing case keeps equality checks and
 * the unique index stable.
 */
export function labelColor(value: string): string {
  const color = value.trim()

  if (!LABEL_COLOR_PATTERN.test(color)) {
    throw new InvalidLabelError("a label color must be a six-digit hex value such as #d73a4a")
  }

  return color.toLowerCase()
}

export function labelScope(teamId: TeamId | null): LabelScope {
  return teamId === null ? { kind: "workspace" } : { kind: "team", teamId }
}

export function labelAppliesToTeam(scope: LabelScope, issueTeamId: TeamId): boolean {
  return scope.kind === "workspace" || scope.teamId === issueTeamId
}
