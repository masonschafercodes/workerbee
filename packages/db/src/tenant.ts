import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  sql,
} from "drizzle-orm"
import {
  formatIdentifier,
  newId,
  teamKey,
  workspaceId as toWorkspaceId,
  type ActorId,
  type Priority,
  type StateCategory,
  type TeamId,
  type WorkspaceId,
  type WorkspaceRole,
} from "@workerbee/domain"
import type { Change, Changeset } from "@workerbee/sync"
import type { Database } from "./client"
import * as schema from "./schema"

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`)
    this.name = "NotFoundError"
  }
}

export class ConflictError extends Error {
  constructor(what: string) {
    super(`${what} changed since it was read`)
    this.name = "ConflictError"
  }
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

export type TeamStateInput = {
  readonly name: string
  readonly category: StateCategory
  readonly position: number
}

export type CreateIssueInput = {
  readonly teamId: TeamId
  readonly stateId: string
  readonly title: string
  readonly description?: string
  readonly priority?: Priority
  readonly assigneeId?: ActorId | null
  readonly creatorId: ActorId
}

export type IssuePatch = {
  readonly title?: string
  readonly description?: string
  readonly stateId?: string
  readonly priority?: Priority
  readonly assigneeId?: ActorId | null
}

export type BootstrapSnapshot = Awaited<ReturnType<TenantDb["bootstrap"]>>

const issueSummaryFields = {
  id: schema.issue.id,
  teamId: schema.issue.teamId,
  number: schema.issue.number,
  identifier: schema.issue.identifier,
  title: schema.issue.title,
  stateId: schema.issue.stateId,
  priority: schema.issue.priority,
  assigneeId: schema.issue.assigneeId,
  parentId: schema.issue.parentId,
  updatedAt: schema.issue.updatedAt,
  version: schema.issue.version,
}

function knownRole(value: string): WorkspaceRole | null {
  return value === "owner" || value === "admin" || value === "member" ? value : null
}

function roleOf(value: string): WorkspaceRole {
  return knownRole(value) ?? "member"
}

async function nextSeq(tx: Transaction, workspaceId: WorkspaceId): Promise<number> {
  const [row] = await tx
    .insert(schema.workspaceSeq)
    .values({ workspaceId, seq: 1 })
    .onConflictDoUpdate({
      target: schema.workspaceSeq.workspaceId,
      set: { seq: sql`${schema.workspaceSeq.seq} + 1` },
    })
    .returning({ seq: schema.workspaceSeq.seq })

  if (row === undefined) {
    throw new Error("failed to allocate a workspace seq")
  }

  return row.seq
}

async function appendChangeset(
  tx: Transaction,
  workspaceId: WorkspaceId,
  actorId: ActorId,
  changes: readonly Change[],
): Promise<number> {
  if (changes.length === 0) {
    throw new Error("a changeset needs at least one change")
  }

  const seq = await nextSeq(tx, workspaceId)

  await tx.insert(schema.changeset).values({
    workspaceId,
    seq,
    actorId,
    changeCount: changes.length,
  })

  await tx.insert(schema.change).values(
    changes.map((change) => ({
      id: newId(),
      workspaceId,
      seq,
      entity: change.entity,
      entityId: change.id,
      teamId: change.teamId,
      op: change.op,
      patch: change.patch,
    })),
  )

  return seq
}

/**
 * Every read and write goes through a tenant-bound instance. The constructor
 * requires a workspace, and every query below filters on it. Cross-tenant ids
 * therefore return nothing or fail, which the isolation suite proves.
 */
export class TenantDb {
  constructor(
    readonly db: Database,
    readonly workspaceId: WorkspaceId,
  ) {}

  async bootstrap() {
    // One repeatable-read snapshot, so the cursor and the rows it describes
    // cannot come from different points in time.
    return this.db.transaction(
      async (tx) => {
        const [workspace] = await tx
          .select({ id: schema.workspace.id, slug: schema.workspace.slug, name: schema.workspace.name })
          .from(schema.workspace)
          .where(eq(schema.workspace.id, this.workspaceId))
          .limit(1)

        if (workspace === undefined) {
          throw new NotFoundError("workspace")
        }

        const teams = await tx
          .select({
            id: schema.team.id,
            key: schema.team.key,
            name: schema.team.name,
            issueCounter: schema.team.issueCounter,
          })
          .from(schema.team)
          .where(eq(schema.team.workspaceId, this.workspaceId))
          .orderBy(asc(schema.team.key))

        const teamIds = teams.map((team) => team.id)

        const states =
          teamIds.length === 0
            ? []
            : await tx
                .select({
                  id: schema.workflowState.id,
                  teamId: schema.workflowState.teamId,
                  name: schema.workflowState.name,
                  category: schema.workflowState.category,
                  position: schema.workflowState.position,
                })
                .from(schema.workflowState)
                .where(
                  and(
                    eq(schema.workflowState.workspaceId, this.workspaceId),
                    inArray(schema.workflowState.teamId, teamIds),
                  ),
                )
                .orderBy(asc(schema.workflowState.teamId), asc(schema.workflowState.position))

        const members = await tx
          .select({
            actorId: schema.member.userId,
            role: schema.member.role,
            kind: schema.actor.kind,
            name: schema.user.name,
          })
          .from(schema.member)
          .innerJoin(schema.actor, eq(schema.actor.id, schema.member.userId))
          .leftJoin(schema.user, eq(schema.user.id, schema.member.userId))
          .where(eq(schema.member.organizationId, this.workspaceId))

        const issues = await this.issuesQuery(tx)

        const [seqRow] = await tx
          .select({ seq: schema.workspaceSeq.seq })
          .from(schema.workspaceSeq)
          .where(eq(schema.workspaceSeq.workspaceId, this.workspaceId))
          .limit(1)

        return {
          seq: seqRow?.seq ?? 0,
          workspace,
          teams,
          states,
          members: members.map((member) => ({ ...member, role: roleOf(member.role) })),
          issues,
        }
      },
      { isolationLevel: "repeatable read" },
    )
  }

  private issuesQuery(db: Database | Transaction) {
    return db
      .select(issueSummaryFields)
      .from(schema.issue)
      .where(
        and(
          eq(schema.issue.workspaceId, this.workspaceId),
          isNull(schema.issue.archivedAt),
        ),
      )
      .orderBy(desc(schema.issue.updatedAt), asc(schema.issue.identifier))
  }

  async listIssues() {
    return this.issuesQuery(this.db)
  }

  async issueById(id: string) {
    const [row] = await this.db
      .select()
      .from(schema.issue)
      .where(and(eq(schema.issue.workspaceId, this.workspaceId), eq(schema.issue.id, id)))
      .limit(1)

    return row ?? null
  }

  async commentsForIssue(issueId: string) {
    return this.db
      .select({
        id: schema.comment.id,
        issueId: schema.comment.issueId,
        authorId: schema.comment.authorId,
        authorName: schema.user.name,
        body: schema.comment.body,
        createdAt: schema.comment.createdAt,
        editedAt: schema.comment.editedAt,
      })
      .from(schema.comment)
      .leftJoin(schema.user, eq(schema.user.id, schema.comment.authorId))
      .where(
        and(
          eq(schema.comment.workspaceId, this.workspaceId),
          eq(schema.comment.issueId, issueId),
          isNull(schema.comment.deletedAt),
        ),
      )
      .orderBy(asc(schema.comment.createdAt))
  }

  async createIssue(input: CreateIssueInput) {
    return this.db.transaction(async (tx) => {
      const [team] = await tx
        .select({ id: schema.team.id, key: schema.team.key })
        .from(schema.team)
        .where(
          and(
            eq(schema.team.workspaceId, this.workspaceId),
            eq(schema.team.id, input.teamId),
          ),
        )
        .limit(1)

      if (team === undefined) {
        throw new NotFoundError("team")
      }

      const [state] = await tx
        .select({ id: schema.workflowState.id })
        .from(schema.workflowState)
        .where(
          and(
            eq(schema.workflowState.workspaceId, this.workspaceId),
            eq(schema.workflowState.teamId, input.teamId),
            eq(schema.workflowState.id, input.stateId),
          ),
        )
        .limit(1)

      if (state === undefined) {
        throw new NotFoundError("state")
      }

      const [bumped] = await tx
        .update(schema.team)
        .set({
          issueCounter: sql`${schema.team.issueCounter} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.team.workspaceId, this.workspaceId),
            eq(schema.team.id, input.teamId),
          ),
        )
        .returning({ number: schema.team.issueCounter })

      if (bumped === undefined) {
        throw new NotFoundError("team")
      }

      const identifier = formatIdentifier(teamKey(team.key), bumped.number)

      const [created] = await tx
        .insert(schema.issue)
        .values({
          id: newId(),
          workspaceId: this.workspaceId,
          teamId: input.teamId,
          number: bumped.number,
          identifier,
          title: input.title,
          description: input.description ?? "",
          stateId: input.stateId,
          priority: input.priority ?? "none",
          assigneeId: input.assigneeId ?? null,
          creatorId: input.creatorId,
        })
        .returning()

      if (created === undefined) {
        throw new Error("failed to create the issue")
      }

      const seq = await appendChangeset(tx, this.workspaceId, input.creatorId, [
        {
          entity: "issue",
          id: created.id,
          teamId: created.teamId,
          op: "insert",
          patch: {
            id: created.id,
            teamId: created.teamId,
            number: created.number,
            identifier: created.identifier,
            title: created.title,
            stateId: created.stateId,
            priority: created.priority,
            assigneeId: created.assigneeId,
            parentId: created.parentId,
            updatedAt: created.updatedAt.toISOString(),
            version: created.version,
          },
        },
      ])

      return { issue: created, seq }
    })
  }

  async updateIssue(
    id: string,
    patch: IssuePatch,
    actorId: ActorId,
    expectedVersion?: number,
  ) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.issue)
        .where(
          and(eq(schema.issue.workspaceId, this.workspaceId), eq(schema.issue.id, id)),
        )
        .for("update")
        .limit(1)

      if (existing === undefined) {
        throw new NotFoundError("issue")
      }

      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw new ConflictError("issue")
      }

      const changes: Record<string, unknown> = {}

      if (patch.title !== undefined && patch.title !== existing.title) {
        changes.title = patch.title
      }

      if (patch.description !== undefined && patch.description !== existing.description) {
        changes.description = patch.description
      }

      if (patch.stateId !== undefined && patch.stateId !== existing.stateId) {
        const [state] = await tx
          .select({ id: schema.workflowState.id })
          .from(schema.workflowState)
          .where(
            and(
              eq(schema.workflowState.workspaceId, this.workspaceId),
              eq(schema.workflowState.teamId, existing.teamId),
              eq(schema.workflowState.id, patch.stateId),
            ),
          )
          .limit(1)

        if (state === undefined) {
          throw new NotFoundError("state")
        }

        changes.stateId = patch.stateId
      }

      if (patch.priority !== undefined && patch.priority !== existing.priority) {
        changes.priority = patch.priority
      }

      if (patch.assigneeId !== undefined && patch.assigneeId !== existing.assigneeId) {
        changes.assigneeId = patch.assigneeId
      }

      if (Object.keys(changes).length === 0) {
        return { issue: existing, seq: null }
      }

      const version = existing.version + 1
      const updatedAt = new Date()

      const [updated] = await tx
        .update(schema.issue)
        .set({ ...changes, version, updatedAt })
        .where(
          and(eq(schema.issue.workspaceId, this.workspaceId), eq(schema.issue.id, id)),
        )
        .returning()

      if (updated === undefined) {
        throw new NotFoundError("issue")
      }

      const seq = await appendChangeset(tx, this.workspaceId, actorId, [
        {
          entity: "issue",
          id,
          teamId: existing.teamId,
          op: "update",
          patch: { ...changes, version, updatedAt: updatedAt.toISOString() },
        },
      ])

      return { issue: updated, seq }
    })
  }

  async ensureTeam(input: {
    key: string
    name: string
    actorId: ActorId
    states: readonly TeamStateInput[]
  }) {
    return this.db.transaction(async (tx) => {
      const key = teamKey(input.key)
      const byKey = and(
        eq(schema.team.workspaceId, this.workspaceId),
        eq(schema.team.key, key),
      )

      const readStates = (teamId: string) =>
        tx
          .select()
          .from(schema.workflowState)
          .where(
            and(
              eq(schema.workflowState.workspaceId, this.workspaceId),
              eq(schema.workflowState.teamId, teamId),
            ),
          )
          .orderBy(asc(schema.workflowState.position))

      const [existing] = await tx.select().from(schema.team).where(byKey).limit(1)

      if (existing !== undefined) {
        return { team: existing, states: await readStates(existing.id), seq: null }
      }

      const [inserted] = await tx
        .insert(schema.team)
        .values({
          id: newId(),
          workspaceId: this.workspaceId,
          key,
          name: input.name,
        })
        .onConflictDoNothing()
        .returning()

      if (inserted === undefined) {
        const [winner] = await tx.select().from(schema.team).where(byKey).limit(1)

        if (winner === undefined) {
          throw new Error("failed to create the team")
        }

        return { team: winner, states: await readStates(winner.id), seq: null }
      }

      const states =
        input.states.length === 0
          ? []
          : await tx
              .insert(schema.workflowState)
              .values(
                input.states.map((state) => ({
                  id: newId(),
                  workspaceId: this.workspaceId,
                  teamId: inserted.id,
                  name: state.name,
                  category: state.category,
                  position: state.position,
                })),
              )
              .returning()

      const seq = await appendChangeset(tx, this.workspaceId, input.actorId, [
        {
          entity: "team",
          id: inserted.id,
          teamId: null,
          op: "insert",
          patch: { id: inserted.id, key: inserted.key, name: inserted.name },
        },
        ...states.map((state) => ({
          entity: "state" as const,
          id: state.id,
          teamId: inserted.id,
          op: "insert" as const,
          patch: {
            id: state.id,
            teamId: inserted.id,
            name: state.name,
            category: state.category,
            position: state.position,
          },
        })),
      ])

      return { team: inserted, states, seq }
    })
  }

  async addComment(issueId: string, body: string, authorId: ActorId) {
    return this.db.transaction(async (tx) => {
      const [issue] = await tx
        .select({ id: schema.issue.id, teamId: schema.issue.teamId })
        .from(schema.issue)
        .where(
          and(
            eq(schema.issue.workspaceId, this.workspaceId),
            eq(schema.issue.id, issueId),
          ),
        )
        .limit(1)

      if (issue === undefined) {
        throw new NotFoundError("issue")
      }

      const [created] = await tx
        .insert(schema.comment)
        .values({
          id: newId(),
          workspaceId: this.workspaceId,
          issueId,
          authorId,
          body,
        })
        .returning()

      if (created === undefined) {
        throw new Error("failed to create the comment")
      }

      const seq = await appendChangeset(tx, this.workspaceId, authorId, [
        {
          entity: "comment",
          id: created.id,
          teamId: issue.teamId,
          op: "insert",
          patch: {
            issueId,
            body: created.body,
            authorId,
            createdAt: created.createdAt.toISOString(),
          },
        },
      ])

      return { comment: created, seq }
    })
  }

  async latestSeq(): Promise<number> {
    const [row] = await this.db
      .select({ seq: schema.workspaceSeq.seq })
      .from(schema.workspaceSeq)
      .where(eq(schema.workspaceSeq.workspaceId, this.workspaceId))
      .limit(1)

    return row?.seq ?? 0
  }

  async changesSince(since: number, limit = 100): Promise<Changeset[]> {
    const sets = await this.db
      .select({
        seq: schema.changeset.seq,
        actorId: schema.changeset.actorId,
        createdAt: schema.changeset.createdAt,
      })
      .from(schema.changeset)
      .where(
        and(
          eq(schema.changeset.workspaceId, this.workspaceId),
          gt(schema.changeset.seq, since),
        ),
      )
      .orderBy(asc(schema.changeset.seq))
      .limit(limit)

    if (sets.length === 0) {
      return []
    }

    const seqs = sets.map((set) => set.seq)

    const rows = await this.db
      .select()
      .from(schema.change)
      .where(
        and(
          eq(schema.change.workspaceId, this.workspaceId),
          inArray(schema.change.seq, seqs),
        ),
      )
      .orderBy(asc(schema.change.seq))

    const bySeq = new Map<number, Change[]>()

    for (const row of rows) {
      const changes = bySeq.get(row.seq) ?? []
      changes.push({
        entity: row.entity,
        id: row.entityId,
        teamId: row.teamId,
        op: row.op,
        patch: row.patch,
      })
      bySeq.set(row.seq, changes)
    }

    return sets.map((set) => ({
      seq: set.seq,
      at: set.createdAt.toISOString(),
      actorId: set.actorId,
      changes: bySeq.get(set.seq) ?? [],
    }))
  }
}

export async function findMembership(
  db: Database,
  slug: string,
  userId: string,
): Promise<{ workspaceId: WorkspaceId; role: WorkspaceRole } | null> {
  const [row] = await db
    .select({ id: schema.workspace.id, role: schema.member.role })
    .from(schema.workspace)
    .innerJoin(schema.member, eq(schema.member.organizationId, schema.workspace.id))
    .where(and(eq(schema.workspace.slug, slug), eq(schema.member.userId, userId)))
    .limit(1)

  if (row === undefined) {
    return null
  }

  const role = knownRole(row.role)

  if (role === null) {
    return null
  }

  return { workspaceId: toWorkspaceId(row.id), role }
}

export async function listMemberships(db: Database, userId: string) {
  const rows = await db
    .select({
      id: schema.workspace.id,
      slug: schema.workspace.slug,
      name: schema.workspace.name,
      role: schema.member.role,
    })
    .from(schema.member)
    .innerJoin(schema.workspace, eq(schema.member.organizationId, schema.workspace.id))
    .where(eq(schema.member.userId, userId))
    .orderBy(asc(schema.workspace.name))

  return rows.map((row) => ({ ...row, role: roleOf(row.role) }))
}

export async function findWorkspaceBySlug(db: Database, slug: string) {
  const [row] = await db
    .select({
      id: schema.workspace.id,
      slug: schema.workspace.slug,
      name: schema.workspace.name,
    })
    .from(schema.workspace)
    .where(eq(schema.workspace.slug, slug))
    .limit(1)

  return row ?? null
}
