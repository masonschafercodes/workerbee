import { z } from "zod"

export const ENTITY_NAMES = [
  "workspace",
  "team",
  "state",
  "issue",
  "comment",
  "label",
  "project",
  "cycle",
  "member",
  "agent",
] as const

export type EntityName = (typeof ENTITY_NAMES)[number]

export const CHANGE_OPS = ["insert", "update", "delete"] as const

export type ChangeOp = (typeof CHANGE_OPS)[number]

export const MAX_CHANGES_PER_CHANGESET = 500
export const MAX_PATCH_BYTES = 8_192

const encoder = new TextEncoder()

function patchBytes(patch: Record<string, unknown>): number {
  return encoder.encode(JSON.stringify(patch)).length
}

const patchSchema = z.record(z.string(), z.unknown()).refine(
  (patch) => patchBytes(patch) <= MAX_PATCH_BYTES,
  { message: `patch exceeds ${MAX_PATCH_BYTES} bytes` },
)

/**
 * Entities that always belong to a team. A null team on one of these would make
 * a team-scoped row visible to the whole workspace, so the schema rejects it.
 */
const TEAM_REQUIRED: ReadonlySet<EntityName> = new Set<EntityName>(["issue", "comment", "state"])

export const changeSchema = z
  .object({
    entity: z.enum(ENTITY_NAMES),
    id: z.string().min(1).max(64),
    // Null for workspace-level entities such as members and teams.
    teamId: z.string().min(1).max(64).nullable(),
    op: z.enum(CHANGE_OPS),
    patch: patchSchema,
  })
  .superRefine((change, ctx) => {
    if (change.teamId === null && TEAM_REQUIRED.has(change.entity)) {
      ctx.addIssue({
        code: "custom",
        message: `${change.entity} requires a teamId`,
        path: ["teamId"],
      })
    }

    const keys = Object.keys(change.patch)

    if (change.op === "delete" && keys.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "a delete change carries no patch",
        path: ["patch"],
      })
    }

    if (change.op !== "delete" && keys.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: `${change.op} requires a patch`,
        path: ["patch"],
      })
    }
  })

export const changesetSchema = z.object({
  seq: z.number().int().positive(),
  at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "at must be an ISO timestamp",
  }),
  actorId: z.string().min(1).max(64),
  changes: z.array(changeSchema).min(1).max(MAX_CHANGES_PER_CHANGESET),
})

export type Change = z.infer<typeof changeSchema>
export type Changeset = z.infer<typeof changesetSchema>

export function parseChangeset(value: unknown): Changeset {
  return changesetSchema.parse(value)
}
