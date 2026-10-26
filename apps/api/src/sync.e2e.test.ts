import { createAuth } from "@workerbee/auth"
import {
  createDb,
  team,
  TenantDb,
  workflowState,
} from "@workerbee/db"
import {
  actorId,
  teamId as toTeamId,
  workspaceId as toWorkspaceId,
  type TeamId,
} from "@workerbee/domain"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { and, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { join } from "node:path"
import { createApp } from "./app"

const url = Bun.env.TEST_DATABASE_URL
const describeDb = url === undefined ? describe.skip : describe
const SECRET = "test-secret-0123456789abcdef0123456789abcdef"
const ORIGIN = "http://localhost:3001"
const PASSWORD = "correct-horse-battery-staple"

type Account = {
  readonly userId: string
  readonly cookie: string
  readonly workspaceId: string
  readonly slug: string
  readonly teamId: TeamId
  readonly stateId: string
}

describeDb("bootstrap and sync", () => {
  const { db, pool } = createDb(url ?? "postgres://unused")
  const auth = createAuth({ db, secret: SECRET, baseURL: ORIGIN })
  const app = createApp({ auth, db, origin: ORIGIN })

  let mason!: Account
  let other!: Account
  let issueId = ""
  let issueVersion = 0

  async function signIn(email: string): Promise<string> {
    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, password: PASSWORD }),
    })

    return response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
  }

  async function provision(email: string, slug: string): Promise<Account> {
    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, password: PASSWORD, name: email }),
    })

    const created = (await signUp.json()) as { user: { id: string } }
    const cookie = await signIn(email)

    const workspaceResponse = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        cookie,
      },
      body: JSON.stringify({ name: slug, slug }),
    })

    const organization = (await workspaceResponse.json()) as { id: string }
    const wid = toWorkspaceId(organization.id)

    const [defaultTeam] = await db
      .select()
      .from(team)
      .where(and(eq(team.workspaceId, wid), eq(team.key, "ENG")))
      .limit(1)

    if (defaultTeam === undefined) {
      throw new Error("workspace creation did not provision a team")
    }

    const [defaultState] = await db
      .select()
      .from(workflowState)
      .where(
        and(
          eq(workflowState.teamId, defaultTeam.id),
          eq(workflowState.category, "unstarted"),
        ),
      )
      .limit(1)

    if (defaultState === undefined) {
      throw new Error("workspace creation did not provision states")
    }

    const teamId = toTeamId(defaultTeam.id)
    const stateId = defaultState.id

    return {
      userId: created.user.id,
      cookie,
      workspaceId: organization.id,
      slug,
      teamId,
      stateId,
    }
  }

  function headers(account: Account, workspace = account.slug) {
    return {
      cookie: account.cookie,
      "x-workerbee-workspace": workspace,
    }
  }

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: join(import.meta.dir, "../../../packages/db/drizzle") })

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

    mason = await provision("mason@example.com", "acme")
    other = await provision("other@example.com", "other")

    const otherTenant = new TenantDb(db, toWorkspaceId(other.workspaceId))
    await otherTenant.createIssue({
      teamId: other.teamId,
      stateId: other.stateId,
      title: "Other workspace issue",
      creatorId: actorId(other.userId),
    })
  })

  afterAll(async () => {
    await pool.end()
  })

  test("bootstrap returns the workspace, teams, and an empty issue list", async () => {
    const response = await app.request("/api/v1/bootstrap", {
      headers: headers(mason),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      seq: number
      workspace: { slug: string }
      teams: unknown[]
      states: unknown[]
      issues: unknown[]
      members: Array<{ actorId: string; name: string | null }>
      actor: { id: string }
    }

    expect(body.workspace.slug).toBe("acme")
    expect(body.teams).toHaveLength(1)
    expect(body.states).toHaveLength(5)
    expect(body.issues).toEqual([])
    expect(body.seq).toBe(1)
    expect(body.actor.id).toBe(mason.userId)
    expect(body.members[0]?.name).toBe("mason@example.com")
  })

  test("creating an issue writes one changeset", async () => {
    const response = await app.request("/api/v1/issues", {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({
        teamId: mason.teamId,
        stateId: mason.stateId,
        title: "First issue",
        priority: "high",
      }),
    })

    expect(response.status).toBe(201)

    const body = (await response.json()) as {
      issue: { id: string; identifier: string; title: string; version: number }
      seq: number
    }

    issueId = body.issue.id
    issueVersion = body.issue.version

    expect(body.issue.identifier).toBe("ENG-1")
    expect(body.issue.title).toBe("First issue")
    expect(body.seq).toBe(2)
  })

  test("sync returns the changeset and then nothing new", async () => {
    const first = await app.request("/api/v1/sync?since=0", {
      headers: headers(mason),
    })

    expect(first.status).toBe(200)

    const { changesets } = (await first.json()) as {
      changesets: Array<{
        seq: number
        changes: Array<{
          entity: string
          teamId: string | null
          op: string
          patch: Record<string, unknown>
        }>
      }>
    }

    const issueSet = changesets.find((set) =>
      set.changes.some((change) => change.entity === "issue"),
    )

    expect(issueSet?.seq).toBe(2)
    expect(issueSet?.changes[0]).toMatchObject({
      entity: "issue",
      teamId: mason.teamId,
      op: "insert",
      patch: { identifier: "ENG-1" },
    })

    const second = await app.request("/api/v1/sync?since=2", {
      headers: headers(mason),
    })

    expect(((await second.json()) as { changesets: unknown[] }).changesets).toEqual([])
  })

  test("comments are readable and arrive through sync", async () => {
    const created = await app.request(`/api/v1/issues/${issueId}/comments`, {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ body: "Looks good" }),
    })

    expect(created.status).toBe(201)

    const createdBody = (await created.json()) as {
      comment: { body: string }
      seq: number
    }

    expect(createdBody.comment.body).toBe("Looks good")
    expect(createdBody.seq).toBe(3)

    const list = await app.request(`/api/v1/issues/${issueId}/comments`, {
      headers: headers(mason),
    })
    const { comments } = (await list.json()) as {
      comments: Array<{ body: string }>
    }

    expect(comments).toHaveLength(1)
    expect(comments[0]?.body).toBe("Looks good")
    expect(comments[0]).toMatchObject({ authorName: "mason@example.com" })

    const sync = await app.request("/api/v1/sync?since=2", {
      headers: headers(mason),
    })
    const { changesets } = (await sync.json()) as {
      changesets: Array<{
        seq: number
        changes: Array<{ entity: string; teamId: string | null; op: string }>
      }>
    }

    expect(changesets).toHaveLength(1)
    expect(changesets[0]?.seq).toBe(3)
    expect(changesets[0]?.changes[0]).toMatchObject({
      entity: "comment",
      teamId: mason.teamId,
      op: "insert",
    })
  })

  test("bootstrap and sync never include another workspace", async () => {
    const bootstrap = await app.request("/api/v1/bootstrap", {
      headers: headers(mason),
    })
    const snapshot = (await bootstrap.json()) as {
      issues: Array<{ identifier: string }>
      teams: Array<{ key: string }>
    }

    expect(snapshot.issues.map((issue) => issue.identifier)).toEqual(["ENG-1"])
    expect(snapshot.teams.map((team) => team.key)).toEqual(["ENG"])

    const sync = await app.request("/api/v1/sync?since=0&limit=500", {
      headers: headers(mason),
    })
    const { changesets } = (await sync.json()) as {
      changesets: Array<{ changes: Array<{ teamId: string | null }> }>
    }

    const teamIds = changesets
      .flatMap((set) => set.changes)
      .map((change) => change.teamId)

    expect(teamIds.length).toBeGreaterThan(0)
    expect(teamIds.every((teamId) => teamId === null || teamId === mason.teamId)).toBe(true)
  })

  test("a member of one workspace cannot address another", async () => {
    const response = await app.request("/api/v1/bootstrap", {
      headers: headers(mason, other.slug),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "workspace_not_found" })
  })

  test("an issue cannot reference a team from another workspace", async () => {
    const response = await app.request("/api/v1/issues", {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({
        teamId: other.teamId,
        stateId: other.stateId,
        title: "Hijack",
      }),
    })

    expect(response.status).toBe(404)
  })

  test("the workspace header is required", async () => {
    const missing = await app.request("/api/v1/bootstrap", {
      headers: { cookie: mason.cookie },
    })

    expect(missing.status).toBe(400)
  })

  test("workspaces lists the caller's memberships", async () => {
    const response = await app.request("/api/v1/workspaces", {
      headers: { cookie: mason.cookie },
    })

    expect(response.status).toBe(200)

    const { workspaces } = (await response.json()) as {
      workspaces: Array<{ slug: string; role: string }>
    }

    expect(workspaces).toHaveLength(1)
    expect(workspaces[0]).toMatchObject({ slug: "acme", role: "owner" })
  })

  test("workspace creation is idempotent for its owner", async () => {
    const retry = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: mason.cookie },
      body: JSON.stringify({ name: "Acme", slug: "acme" }),
    })

    expect(retry.status).toBe(200)

    const body = (await retry.json()) as { id: string }

    expect(body.id).toBe(mason.workspaceId)

    const bootstrap = await app.request("/api/v1/bootstrap", {
      headers: headers(mason),
    })
    const snapshot = (await bootstrap.json()) as { teams: unknown[] }

    expect(snapshot.teams).toHaveLength(1)
  })

  test("another user cannot claim an existing workspace slug", async () => {
    const response = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: other.cookie },
      body: JSON.stringify({ name: "Acme", slug: "acme" }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "workspace_exists" })
  })

  test("an issue can be read and updated with optimistic concurrency", async () => {
    const read = await app.request(`/api/v1/issues/${issueId}`, {
      headers: headers(mason),
    })

    expect(read.status).toBe(200)

    const detail = (await read.json()) as {
      issue: { id: string; title: string; version: number }
    }

    expect(detail.issue.title).toBe("First issue")
    expect(detail.issue.version).toBe(issueVersion)

    const updated = await app.request(`/api/v1/issues/${issueId}`, {
      method: "PATCH",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ priority: "urgent", version: issueVersion }),
    })

    expect(updated.status).toBe(200)

    const updatedBody = (await updated.json()) as {
      issue: { priority: string; version: number }
      seq: number | null
    }

    expect(updatedBody.issue.priority).toBe("urgent")
    expect(updatedBody.issue.version).toBe(issueVersion + 1)
    expect(updatedBody.seq).toBe(4)

    const stale = await app.request(`/api/v1/issues/${issueId}`, {
      method: "PATCH",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ title: "Stale write", version: issueVersion }),
    })

    expect(stale.status).toBe(409)
  })

  test("an issue cannot move to another team's state", async () => {
    const response = await app.request(`/api/v1/issues/${issueId}`, {
      method: "PATCH",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ stateId: other.stateId }),
    })

    expect(response.status).toBe(404)
  })
})
