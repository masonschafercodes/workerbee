import type { ActorKind, Priority, StateCategory } from "@workerbee/domain"
import type { ChangeOp, EntityName } from "@workerbee/sync"
import { sql } from "drizzle-orm"
import {
  bigint,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { organization } from "./auth"

/**
 * The workspace is the Better Auth organization table. Keep the Better Auth
 * name out of domain code by importing this alias.
 */
export const workspace = organization

export const actor = pgTable(
  "actor",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<ActorKind>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("actor_kind_idx").on(table.kind)],
)

export const workspaceSeq = pgTable(
  "workspace_seq",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspace.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull().default(0),
  },
)

export const team = pgTable(
  "team",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    issueCounter: integer("issue_counter").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_workspace_key_unique").on(table.workspaceId, table.key),
    // Redundant to the primary key, but Postgres needs it as a composite FK target.
    unique("team_workspace_id_unique").on(table.workspaceId, table.id),
    index("team_workspace_idx").on(table.workspaceId),
  ],
)

export const workflowState = pgTable(
  "workflow_state",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    teamId: text("team_id").notNull(),
    name: text("name").notNull(),
    category: text("category").$type<StateCategory>().notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workflow_state_team_name_unique").on(table.teamId, table.name),
    unique("workflow_state_workspace_team_id_unique").on(
      table.workspaceId,
      table.teamId,
      table.id,
    ),
    index("workflow_state_team_position_idx").on(table.teamId, table.position),
    foreignKey({
      name: "workflow_state_team_fk",
      columns: [table.workspaceId, table.teamId],
      foreignColumns: [team.workspaceId, team.id],
    }).onDelete("cascade"),
  ],
)

export const issue = pgTable(
  "issue",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    teamId: text("team_id").notNull(),
    number: integer("number").notNull(),
    identifier: text("identifier").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    stateId: text("state_id").notNull(),
    priority: text("priority").$type<Priority>().notNull().default("none"),
    assigneeId: text("assignee_id").references(() => actor.id, { onDelete: "set null" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => actor.id, { onDelete: "restrict" }),
    parentId: text("parent_id"),
    estimate: integer("estimate"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("issue_team_number_unique").on(table.teamId, table.number),
    uniqueIndex("issue_workspace_identifier_unique").on(
      table.workspaceId,
      table.identifier,
    ),
    unique("issue_workspace_id_unique").on(table.workspaceId, table.id),
    index("issue_workspace_updated_idx").on(table.workspaceId, table.updatedAt),
    index("issue_workspace_team_state_idx").on(
      table.workspaceId,
      table.teamId,
      table.stateId,
    ),
    index("issue_workspace_assignee_idx").on(table.workspaceId, table.assigneeId),
    foreignKey({
      name: "issue_team_fk",
      columns: [table.workspaceId, table.teamId],
      foreignColumns: [team.workspaceId, team.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "issue_state_fk",
      columns: [table.workspaceId, table.teamId, table.stateId],
      foreignColumns: [
        workflowState.workspaceId,
        workflowState.teamId,
        workflowState.id,
      ],
    }).onDelete("restrict"),
  ],
)

export const comment = pgTable(
  "comment",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    issueId: text("issue_id").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => actor.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("comment_issue_created_idx").on(table.issueId, table.createdAt),
    index("comment_workspace_idx").on(table.workspaceId),
    foreignKey({
      name: "comment_issue_fk",
      columns: [table.workspaceId, table.issueId],
      foreignColumns: [issue.workspaceId, issue.id],
    }).onDelete("cascade"),
  ],
)

export const label = pgTable(
  "label",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    teamId: text("team_id"),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("label_workspace_idx").on(table.workspaceId),
    index("label_team_idx").on(table.teamId),
    unique("label_workspace_id_unique").on(table.workspaceId, table.id),
    // A name is unique within its scope, case-insensitively. Two partial
    // indexes cover the null team, which MATCH SIMPLE would otherwise skip.
    uniqueIndex("label_workspace_name_unique")
      .on(table.workspaceId, sql`lower(${table.name})`)
      .where(sql`${table.teamId} is null`),
    uniqueIndex("label_team_name_unique")
      .on(table.workspaceId, table.teamId, sql`lower(${table.name})`)
      .where(sql`${table.teamId} is not null`),
    // A null team means a workspace-level label, and MATCH SIMPLE skips the check.
    foreignKey({
      name: "label_team_fk",
      columns: [table.workspaceId, table.teamId],
      foreignColumns: [team.workspaceId, team.id],
    }).onDelete("cascade"),
  ],
)

export const issueLabel = pgTable(
  "issue_label",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    issueId: text("issue_id").notNull(),
    labelId: text("label_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.labelId] }),
    index("issue_label_workspace_idx").on(table.workspaceId),
    foreignKey({
      name: "issue_label_issue_fk",
      columns: [table.workspaceId, table.issueId],
      foreignColumns: [issue.workspaceId, issue.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "issue_label_label_fk",
      columns: [table.workspaceId, table.labelId],
      foreignColumns: [label.workspaceId, label.id],
    }).onDelete("cascade"),
  ],
)

/**
 * One row per write transaction. Clients apply changesets in seq order. The log
 * is pruned, so it is a replication log, not the source of truth.
 */
export const changeset = pgTable(
  "changeset",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => actor.id, { onDelete: "restrict" }),
    changeCount: integer("change_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.seq] }),
    index("changeset_created_idx").on(table.createdAt),
  ],
)

export const change = pgTable(
  "change",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    seq: bigint("seq", { mode: "number" }).notNull(),
    entity: text("entity").$type<EntityName>().notNull(),
    entityId: text("entity_id").notNull(),
    teamId: text("team_id"),
    op: text("op").$type<ChangeOp>().notNull(),
    patch: jsonb("patch").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    index("change_workspace_seq_idx").on(table.workspaceId, table.seq),
    foreignKey({
      name: "change_changeset_fk",
      columns: [table.workspaceId, table.seq],
      foreignColumns: [changeset.workspaceId, changeset.seq],
    }).onDelete("cascade"),
  ],
)
