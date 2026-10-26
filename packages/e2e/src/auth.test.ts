import { createAuth } from "@workerbee/auth"
import {
  actor,
  createDb,
  issue,
  member,
  team,
  workflowState,
  workspace,
} from "@workerbee/db"
import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { join } from "node:path"
import { createApp } from "@workerbee/api"
import { lockDatabase, unlockDatabase } from "./database-lock"

const url = Bun.env.TEST_DATABASE_URL
const describeDb = url === undefined ? describe.skip : describe
const PASSWORD = "correct-horse-battery-staple"
const SECRET = "test-secret-0123456789abcdef0123456789abcdef"
const ORIGIN = "http://localhost:3001"

describeDb("auth and membership", () => {
  const { db, pool } = createDb(url ?? "postgres://unused")
  const auth = createAuth({ db, secret: SECRET, baseURL: ORIGIN })
  const app = createApp({
    auth,
    db,
    origin: ORIGIN,
    telemetry: { capture() {}, captureException() {}, log() {} },
    realtime: {
      secret: SECRET,
      publisher: { async publish() {} },
      hub: { connect: () => new Response(null, { status: 501 }) },
    },
  })

  let userId = ""

  beforeAll(async () => {
    await lockDatabase(pool)

    await migrate(db, {
      migrationsFolder: join(import.meta.dir, "../../db/drizzle"),
    })

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
  })

  afterAll(async () => {
    await unlockDatabase(pool)
    await pool.end()
  })

  test("sign up creates a user and its actor projection", async () => {
    const response = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({
        email: "mason@example.com",
        password: PASSWORD,
        name: "Mason",
      }),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { user: { id: string; email: string } }
    userId = body.user.id

    expect(body.user.email).toBe("mason@example.com")

    const actors = await db.select().from(actor).where(eq(actor.id, userId))
    expect(actors).toHaveLength(1)
    expect(actors[0]?.kind).toBe("user")
  })

  test("sign in returns a session cookie", async () => {
    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email: "mason@example.com", password: PASSWORD }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie().join(";")).toContain("session_token")
  })

  async function sessionCookie(): Promise<string> {
    const signIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email: "mason@example.com", password: PASSWORD }),
    })

    return signIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
  }

  test("a signed-in user creates a workspace and becomes its owner", async () => {
    const cookie = await sessionCookie()

    const created = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie },
      body: JSON.stringify({ name: "Acme", slug: "Acme" }),
    })

    expect(created.status).toBe(200)

    const org = (await created.json()) as { id: string; slug: string }

    const workspaces = await db.select().from(workspace).where(eq(workspace.id, org.id))
    expect(workspaces).toHaveLength(1)
    expect(workspaces[0]?.slug).toBe("acme")

    const members = await db
      .select()
      .from(member)
      .where(eq(member.organizationId, org.id))

    expect(members).toHaveLength(1)
    expect(members[0]?.role).toBe("owner")
    expect(members[0]?.userId).toBe(userId)
  })

  test("the domain slug rule rejects a bad workspace slug", async () => {
    const cookie = await sessionCookie()

    const created = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie },
      body: JSON.stringify({ name: "Bad", slug: "not a slug" }),
    })

    expect(created.status).toBe(400)
  })

  test("Better Auth's own organization create route is blocked", async () => {
    const cookie = await sessionCookie()

    const created = await app.request("/api/auth/organization/create", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie },
      body: JSON.stringify({ name: "Sneaky", slug: "not a slug" }),
    })

    expect(created.status).toBe(404)
  })

  test("a composite foreign key blocks a cross-workspace issue", async () => {
    await db.insert(workspace).values([
      { id: "ws-a", name: "A", slug: "ws-a", createdAt: new Date() },
      { id: "ws-b", name: "B", slug: "ws-b", createdAt: new Date() },
    ])

    await db.insert(team).values([
      { id: "team-a", workspaceId: "ws-a", key: "AAA", name: "A" },
      { id: "team-b", workspaceId: "ws-b", key: "BBB", name: "B" },
    ])

    await db.insert(workflowState).values({
      id: "state-a",
      workspaceId: "ws-a",
      teamId: "team-a",
      name: "Todo",
      category: "backlog",
    })

    let failure: unknown = null

    try {
      await db.insert(issue).values({
        id: "issue-x",
        workspaceId: "ws-a",
        teamId: "team-b",
        number: 1,
        identifier: "AAA-1",
        title: "Cross workspace",
        stateId: "state-a",
        creatorId: userId,
      })
    } catch (error) {
      failure = error
    }

    expect(failure).not.toBeNull()
    expect(await db.select().from(issue).where(eq(issue.id, "issue-x"))).toHaveLength(0)

    // Same workspace, wrong team: an issue cannot use another team's state.
    await db.insert(team).values({
      id: "team-a2",
      workspaceId: "ws-a",
      key: "AA2",
      name: "A2",
    })

    await db.insert(workflowState).values({
      id: "state-a2",
      workspaceId: "ws-a",
      teamId: "team-a2",
      name: "Todo",
      category: "backlog",
    })

    let stateFailure: unknown = null

    try {
      await db.insert(issue).values({
        id: "issue-y",
        workspaceId: "ws-a",
        teamId: "team-a",
        number: 2,
        identifier: "AAA-2",
        title: "Wrong team state",
        stateId: "state-a2",
        creatorId: userId,
      })
    } catch (error) {
      stateFailure = error
    }

    expect(stateFailure).not.toBeNull()
    expect(await db.select().from(issue).where(eq(issue.id, "issue-y"))).toHaveLength(0)
  })
})
