import { createAuth } from "@workerbee/auth"
import {
  createDb,
  member,
  team,
  TenantDb,
  workflowState,
} from "@workerbee/db"
import {
  actorId,
  newId,
  teamId as toTeamId,
  workspaceId as toWorkspaceId,
  type TeamId,
} from "@workerbee/domain"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { and, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { join } from "node:path"
import { createApp } from "@workerbee/api"
import { lockDatabase, unlockDatabase } from "./database-lock"

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

type LabelBody = {
  readonly id: string
  readonly teamId: string | null
  readonly name: string
  readonly color: string
  readonly createdAt: string
}

describeDb("labels", () => {
  const { db, pool } = createDb(url ?? "postgres://unused")
  const auth = createAuth({ db, secret: SECRET, baseURL: ORIGIN })
  const published: Array<{ workspaceId: string; seq: number }> = []
  const app = createApp({
    auth,
    db,
    origin: ORIGIN,
    telemetry: { capture() {}, captureException() {}, log() {} },
    realtime: {
      secret: SECRET,
      publisher: {
        async publish({ workspaceId, seq }) {
          published.push({ workspaceId, seq })
        },
      },
      hub: { connect: () => new Response(null, { status: 501 }) },
    },
  })

  let mason!: Account
  let other!: Account
  let memberAccount!: Account
  let issueId = ""

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

  async function signUp(email: string): Promise<string> {
    const response = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, password: PASSWORD, name: email }),
    })

    const body = (await response.json()) as { user: { id: string } }

    return body.user.id
  }

  async function provision(email: string, slug: string): Promise<Account> {
    const userId = await signUp(email)
    const cookie = await signIn(email)

    const workspaceResponse = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie },
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

    return {
      userId,
      cookie,
      workspaceId: organization.id,
      slug,
      teamId: toTeamId(defaultTeam.id),
      stateId: defaultState.id,
    }
  }

  function headers(account: Account, workspace = account.slug) {
    return {
      cookie: account.cookie,
      "x-workerbee-workspace": workspace,
    }
  }

  async function createLabel(
    account: Account,
    body: { name: string; color: string; teamId?: string },
  ): Promise<LabelBody> {
    const response = await app.request("/api/v1/labels", {
      method: "POST",
      headers: {
        ...headers(account),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(201)

    return (await response.json()) as LabelBody
  }

  beforeAll(async () => {
    await lockDatabase(pool)

    await migrate(db, { migrationsFolder: join(import.meta.dir, "../../db/drizzle") })

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

    const created = await app.request("/api/v1/issues", {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({
        teamId: mason.teamId,
        stateId: mason.stateId,
        title: "Label target",
      }),
    })

    const body = (await created.json()) as { issue: { id: string } }
    issueId = body.issue.id

    const memberUserId = await signUp("member@example.com")
    const memberCookie = await signIn("member@example.com")

    await db.insert(member).values({
      id: newId(),
      organizationId: mason.workspaceId,
      userId: memberUserId,
      role: "member",
      createdAt: new Date(),
    })

    memberAccount = {
      userId: memberUserId,
      cookie: memberCookie,
      workspaceId: mason.workspaceId,
      slug: mason.slug,
      teamId: mason.teamId,
      stateId: mason.stateId,
    }
  })

  afterAll(async () => {
    await unlockDatabase(pool)
    await pool.end()
  })

  test("a label is created and appears in bootstrap and sync", async () => {
    const label = await createLabel(mason, {
      name: "Bug",
      color: "#D73A4A",
      teamId: mason.teamId,
    })

    expect(label.name).toBe("Bug")
    expect(label.color).toBe("#d73a4a")
    expect(label.teamId).toBe(mason.teamId)
    expect(label.createdAt).toBeTruthy()

    const bootstrap = await app.request("/api/v1/bootstrap", {
      headers: headers(mason),
    })
    const snapshot = (await bootstrap.json()) as {
      labels: Array<{
        id: string
        name: string
        color: string
        teamId: string | null
        createdAt: string
      }>
    }

    expect(snapshot.labels).toContainEqual({
      id: label.id,
      teamId: mason.teamId,
      name: "Bug",
      color: "#d73a4a",
      createdAt: label.createdAt,
    })

    const sync = await app.request("/api/v1/sync?since=0&limit=500", {
      headers: headers(mason),
    })
    const { changesets } = (await sync.json()) as {
      changesets: Array<{
        changes: Array<{
          entity: string
          id: string
          teamId: string | null
          op: string
          patch: Record<string, unknown>
        }>
      }>
    }

    const labelChange = changesets
      .flatMap((set) => set.changes)
      .find((change) => change.entity === "label" && change.id === label.id)

    expect(labelChange).toMatchObject({
      entity: "label",
      teamId: mason.teamId,
      op: "insert",
      patch: { name: "Bug", color: "#d73a4a" },
    })
    expect(published.some((event) => event.workspaceId === mason.workspaceId)).toBe(true)
  })

  test("a duplicate name in the same scope conflicts, case-insensitively", async () => {
    const response = await app.request("/api/v1/labels", {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ name: "bug", color: "#2da44e", teamId: mason.teamId }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "conflict" })
  })

  test("an invalid name or color is a validation error", async () => {
    const empty = await app.request("/api/v1/labels", {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ name: "   ", color: "#d73a4a" }),
    })

    expect(empty.status).toBe(400)

    const badColor = await app.request("/api/v1/labels", {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ name: "design", color: "red" }),
    })

    expect(badColor.status).toBe(400)
  })

  test("a label can be renamed and recolored", async () => {
    const label = await createLabel(mason, { name: "Needs triage", color: "#bf8700" })

    const response = await app.request(`/api/v1/labels/${label.id}`, {
      method: "PATCH",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ name: "Triage", color: "#8250df" }),
    })

    expect(response.status).toBe(200)

    const updated = (await response.json()) as LabelBody
    expect(updated.name).toBe("Triage")
    expect(updated.color).toBe("#8250df")
  })

  test("a failed rename rolls back and writes no changeset", async () => {
    await createLabel(mason, { name: "Alpha", color: "#d73a4a" })
    const beta = await createLabel(mason, { name: "Beta", color: "#2da44e" })
    const tenant = new TenantDb(db, toWorkspaceId(mason.workspaceId))
    const before = await tenant.latestSeq()

    const response = await app.request(`/api/v1/labels/${beta.id}`, {
      method: "PATCH",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ name: "alpha" }),
    })

    expect(response.status).toBe(409)
    expect(await tenant.latestSeq()).toBe(before)

    const list = await app.request("/api/v1/labels", { headers: headers(mason) })
    const body = (await list.json()) as { labels: Array<{ id: string; name: string }> }

    expect(body.labels.find((label) => label.id === beta.id)?.name).toBe("Beta")
  })

  test("members can read labels but cannot manage them", async () => {
    const read = await app.request("/api/v1/labels", {
      headers: headers(memberAccount),
    })

    expect(read.status).toBe(200)

    const write = await app.request("/api/v1/labels", {
      method: "POST",
      headers: {
        ...headers(memberAccount),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ name: "member label", color: "#0969da" }),
    })

    expect(write.status).toBe(403)
  })

  test("members can attach and detach an existing label", async () => {
    const label = await createLabel(mason, { name: "Member usable", color: "#0969da" })

    const attach = await app.request(`/api/v1/issues/${issueId}/labels`, {
      method: "POST",
      headers: {
        ...headers(memberAccount),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ labelId: label.id }),
    })

    expect(attach.status).toBe(204)

    const detach = await app.request(`/api/v1/issues/${issueId}/labels/${label.id}`, {
      method: "DELETE",
      headers: headers(memberAccount),
    })

    expect(detach.status).toBe(204)
  })

  test("a label attaches to and detaches from an issue", async () => {
    const label = await createLabel(mason, {
      name: "Attached",
      color: "#d73a4a",
      teamId: mason.teamId,
    })

    const attach = await app.request(`/api/v1/issues/${issueId}/labels`, {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ labelId: label.id }),
    })

    expect(attach.status).toBe(204)

    const read = await app.request(`/api/v1/issues/${issueId}`, {
      headers: headers(mason),
    })
    const detail = (await read.json()) as {
      issue: {
        labels: Array<{ id: string; name: string; color: string; teamId: string | null }>
      }
    }

    expect(detail.issue.labels.find((item) => item.id === label.id)).toMatchObject({
      teamId: mason.teamId,
      name: "Attached",
      color: "#d73a4a",
    })

    const sync = await app.request("/api/v1/sync?since=0&limit=500", {
      headers: headers(mason),
    })
    const { changesets } = (await sync.json()) as {
      changesets: Array<{
        changes: Array<{
          entity: string
          id: string
          op: string
          patch: Record<string, unknown>
        }>
      }>
    }

    const issueChange = changesets
      .flatMap((set) => set.changes)
      .filter(
        (change) =>
          change.entity === "issue" && change.id === issueId && change.op === "update",
      )
      .at(-1)

    expect(issueChange).toMatchObject({
      entity: "issue",
      id: issueId,
      op: "update",
      patch: {
        labels: [
          {
            id: label.id,
            teamId: mason.teamId,
            name: "Attached",
            color: "#d73a4a",
          },
        ],
      },
    })

    const repeat = await app.request(`/api/v1/issues/${issueId}/labels`, {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ labelId: label.id }),
    })

    expect(repeat.status).toBe(204)

    const detach = await app.request(`/api/v1/issues/${issueId}/labels/${label.id}`, {
      method: "DELETE",
      headers: headers(mason),
    })

    expect(detach.status).toBe(204)

    const after = await app.request(`/api/v1/issues/${issueId}`, {
      headers: headers(mason),
    })
    const afterBody = (await after.json()) as { issue: { labels: unknown[] } }

    expect(afterBody.issue.labels).toEqual([])

    const repeatDetach = await app.request(`/api/v1/issues/${issueId}/labels/${label.id}`, {
      method: "DELETE",
      headers: headers(mason),
    })

    expect(repeatDetach.status).toBe(204)
  })

  test("unknown and foreign ids are not found", async () => {
    const unknownIssue = await app.request("/api/v1/issues/missing/labels", {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ labelId: "missing" }),
    })

    expect(unknownIssue.status).toBe(404)

    const unknownLabel = await app.request(`/api/v1/issues/${issueId}/labels`, {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ labelId: newId() }),
    })

    expect(unknownLabel.status).toBe(404)

    const foreign = await createLabel(other, { name: "Foreign", color: "#d73a4a" })

    const foreignLabel = await app.request(`/api/v1/issues/${issueId}/labels`, {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ labelId: foreign.id }),
    })

    expect(foreignLabel.status).toBe(404)
  })

  test("a team label cannot attach to another team's issue", async () => {
    const teamBId = newId()
    const stateBId = newId()

    await db.insert(team).values({
      id: teamBId,
      workspaceId: toWorkspaceId(mason.workspaceId),
      key: "OPS",
      name: "Ops",
    })

    await db.insert(workflowState).values({
      id: stateBId,
      workspaceId: toWorkspaceId(mason.workspaceId),
      teamId: teamBId,
      name: "Todo",
      category: "backlog",
    })

    const tenant = new TenantDb(db, toWorkspaceId(mason.workspaceId))
    const otherIssue = await tenant.createIssue({
      teamId: toTeamId(teamBId),
      stateId: stateBId,
      title: "Ops issue",
      creatorId: actorId(mason.userId),
    })

    const label = await createLabel(mason, {
      name: "Engineering only",
      color: "#d73a4a",
      teamId: mason.teamId,
    })

    const response = await app.request(`/api/v1/issues/${otherIssue.issue.id}/labels`, {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ labelId: label.id }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "invalid_label" })
  })

  test("an oversized label set is rejected before the commit", async () => {
    const tenant = new TenantDb(db, toWorkspaceId(mason.workspaceId))
    const labelIds: string[] = []

    for (let index = 0; index < 55; index += 1) {
      const created = await tenant.createLabel({
        teamId: mason.teamId,
        name: `label-${index}-${"a".repeat(30)}`,
        color: "#d73a4a",
        actorId: actorId(mason.userId),
      })
      labelIds.push(created.label.id)
    }

    let rejected = false

    for (const labelId of labelIds) {
      const response = await app.request(`/api/v1/issues/${issueId}/labels`, {
        method: "POST",
        headers: {
          ...headers(mason),
          "content-type": "application/json",
          origin: ORIGIN,
        },
        body: JSON.stringify({ labelId }),
      })

      if (response.status === 400) {
        rejected = true
        break
      }

      expect(response.status).toBe(204)
    }

    expect(rejected).toBe(true)

    const read = await app.request(`/api/v1/issues/${issueId}`, {
      headers: headers(mason),
    })
    const detail = (await read.json()) as { issue: { labels: unknown[] } }

    expect(detail.issue.labels.length).toBeLessThan(55)
    expect(detail.issue.labels.length).toBeGreaterThan(0)
  })

  test("deleting a label removes it from issues", async () => {
    const label = await createLabel(mason, { name: "Temporary", color: "#d73a4a" })

    await app.request(`/api/v1/issues/${issueId}/labels`, {
      method: "POST",
      headers: {
        ...headers(mason),
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify({ labelId: label.id }),
    })

    const deleted = await app.request(`/api/v1/labels/${label.id}`, {
      method: "DELETE",
      headers: { ...headers(mason), origin: ORIGIN },
    })

    expect(deleted.status).toBe(204)

    const read = await app.request(`/api/v1/issues/${issueId}`, {
      headers: headers(mason),
    })
    const detail = (await read.json()) as { issue: { labels: Array<{ id: string }> } }

    expect(detail.issue.labels.some((item) => item.id === label.id)).toBe(false)
  })

  test("the workspace header is required for label reads", async () => {
    const response = await app.request("/api/v1/labels", {
      headers: { cookie: mason.cookie },
    })

    expect(response.status).toBe(400)
  })

  test("another workspace's labels never appear in bootstrap", async () => {
    const response = await app.request("/api/v1/bootstrap", {
      headers: headers(mason),
    })
    const snapshot = (await response.json()) as {
      labels: Array<{ name: string }>
    }

    expect(snapshot.labels.some((label) => label.name === "Foreign")).toBe(false)
  })
})
