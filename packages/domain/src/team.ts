import type { IssueIdentifier, TeamKey } from "./ids"

const TEAM_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,4}$/

export class InvalidTeamKeyError extends Error {
  constructor(value: string) {
    super(`Invalid team key: ${JSON.stringify(value)}`)
    this.name = "InvalidTeamKeyError"
  }
}

export function teamKey(value: string): TeamKey {
  const normalized = value.trim().toUpperCase()

  if (!TEAM_KEY_PATTERN.test(normalized)) {
    throw new InvalidTeamKeyError(value)
  }

  return normalized as TeamKey
}

export function isTeamKey(value: string): boolean {
  return TEAM_KEY_PATTERN.test(value)
}

export function formatIdentifier(key: TeamKey, issueNumber: number): IssueIdentifier {
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    throw new RangeError(`Issue number must be a positive integer, got ${issueNumber}`)
  }

  return `${key}-${issueNumber}` as IssueIdentifier
}

export function parseIdentifier(value: string): { key: TeamKey; number: number } | null {
  const match = /^([A-Z][A-Z0-9]{1,4})-([1-9][0-9]*)$/.exec(value)

  if (match === null) {
    return null
  }

  return { key: match[1] as TeamKey, number: Number(match[2]) }
}
