const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

declare const brand: unique symbol

type Branded<T extends string, Name extends string> = T & { readonly [brand]: Name }

export type WorkspaceId = Branded<string, "WorkspaceId">
export type WorkspaceSlug = Branded<string, "WorkspaceSlug">
export type ActorId = Branded<string, "ActorId">
export type TeamId = Branded<string, "TeamId">
export type TeamKey = Branded<string, "TeamKey">
export type IssueId = Branded<string, "IssueId">
export type IssueIdentifier = Branded<string, "IssueIdentifier">
export type CommentId = Branded<string, "CommentId">
export type StateId = Branded<string, "StateId">
export type LabelId = Branded<string, "LabelId">
export type ProjectId = Branded<string, "ProjectId">
export type CycleId = Branded<string, "CycleId">

export class InvalidIdError extends Error {
  constructor(value: string, expected: string) {
    super(`Invalid ${expected}: ${JSON.stringify(value)}`)
    this.name = "InvalidIdError"
  }
}

export function isId(value: string): boolean {
  return UUID_V7_PATTERN.test(value)
}

/**
 * Generates a UUIDv7. The timestamp prefix keeps index inserts roughly ordered,
 * which matters for ids that are primary keys.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const timestamp = BigInt(Date.now())

  bytes[0] = Number((timestamp >> 40n) & 0xffn)
  bytes[1] = Number((timestamp >> 32n) & 0xffn)
  bytes[2] = Number((timestamp >> 24n) & 0xffn)
  bytes[3] = Number((timestamp >> 16n) & 0xffn)
  bytes[4] = Number((timestamp >> 8n) & 0xffn)
  bytes[5] = Number(timestamp & 0xffn)

  bytes[6] = (bytes[6]! & 0x0f) | 0x70
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-")
}

function parse<T extends string>(value: string, expected: string): T {
  if (!isId(value)) {
    throw new InvalidIdError(value, expected)
  }

  return value as T
}

export const newWorkspaceId = (): WorkspaceId => newId() as WorkspaceId
export const newActorId = (): ActorId => newId() as ActorId
export const newTeamId = (): TeamId => newId() as TeamId
export const newIssueId = (): IssueId => newId() as IssueId
export const newCommentId = (): CommentId => newId() as CommentId
export const newStateId = (): StateId => newId() as StateId
export const newLabelId = (): LabelId => newId() as LabelId

export const workspaceId = (value: string): WorkspaceId => parse(value, "workspace id")
export const actorId = (value: string): ActorId => parse(value, "actor id")
export const teamId = (value: string): TeamId => parse(value, "team id")
export const issueId = (value: string): IssueId => parse(value, "issue id")
export const commentId = (value: string): CommentId => parse(value, "comment id")
export const stateId = (value: string): StateId => parse(value, "state id")
export const labelId = (value: string): LabelId => parse(value, "label id")
