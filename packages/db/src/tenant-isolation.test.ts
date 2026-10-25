import {
  newActorId,
  newStateId,
  newTeamId,
  newWorkspaceId,
  workspaceSlug,
} from "@workerbee/domain"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { join } from "node:path"
import { createDb, type Database } from "./client"
import * as schema from "./schema"
import { TenantDb } from "./tenant"
import { tenantProbes, type TenantFixture } from "./tenant-probes"

const url = Bun.env.TEST_DATABASE_URL
const describeDb = url === undefined ? describe.skip : describe

type Seeded = {
  readonly tenant: TenantDb
  readonly ids: TenantFixture
}

async function seed(db: Database, slug: string, teamKeyText: string): Promise<Seeded> {
  const ids = {
    workspaceId: newWorkspaceId(),
    actorId: newActorId(),
    teamId: newTeamId(),
    stateId: newStateId(),
  }

  await db.insert(schema.workspace).values({
    id: ids.workspaceId,
    name: slug,
    slug: workspaceSlug(slug),
    createdAt: new Date(),
  })

  await db.insert(schema.actor).values({ id: ids.actorId, kind: "user" })

  await db.insert(schema.team).values({
    id: ids.teamId,
    workspaceId: ids.workspaceId,
    key: teamKeyText,
    name: slug,
  })

  await db.insert(schema.workflowState).values({
    id: ids.stateId,
    workspaceId: ids.workspaceId,
    teamId: ids.teamId,
    name: "Todo",
    category: "backlog",
  })

  const tenant = new TenantDb(db, ids.workspaceId)
  const created = await tenant.createIssue({
    teamId: ids.teamId,
    stateId: ids.stateId,
    title: `Issue in ${slug}`,
    creatorId: ids.actorId,
  })

  const comment = await tenant.addComment(created.issue.id, "hello", ids.actorId)

  return {
    tenant,
    ids: {
      ...ids,
      issueId: created.issue.id,
      commentId: comment.comment.id,
    },
  }
}

function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) {
      stringsIn(item, out)
    }
  } else if (value instanceof Date) {
    out.push(value.toISOString())
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      stringsIn(item, out)
    }
  }

  return out
}

describeDb("tenant isolation", () => {
  const { db, pool } = createDb(url ?? "postgres://unused")
  let tenantA!: TenantDb
  let foreign!: TenantFixture

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: join(import.meta.dir, "../drizzle") })

    await pool.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
        LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `)

    tenantA = (await seed(db, "tenant-a", "TA")).tenant
    foreign = (await seed(db, "tenant-b", "TB")).ids
  })

  afterAll(async () => {
    await pool.end()
  })

  test("the isolation scan detects a deliberate leak", () => {
    expect(stringsIn({ issueId: foreign.issueId })).toContain(foreign.issueId)
  })

  for (const probe of tenantProbes) {
    test(probe.name, async () => {
      if (probe.expect === "rejects") {
        let rejected = false

        try {
          await probe.run(tenantA, foreign)
        } catch {
          rejected = true
        }

        expect(rejected).toBe(true)
        return
      }

      const result = await probe.run(tenantA, foreign)
      const returned = stringsIn(result)
      const foreignIds = [
        foreign.workspaceId,
        foreign.actorId,
        foreign.teamId,
        foreign.stateId,
        foreign.issueId,
        foreign.commentId,
      ]

      expect(foreignIds.filter((id) => returned.includes(id))).toEqual([])
    })
  }
})
