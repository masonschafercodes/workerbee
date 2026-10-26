import { newActorId, newWorkspaceId } from "@workerbee/domain"
import { describe, expect, test } from "bun:test"
import { queueWakeupSchema, signRealtimeTicket, verifyRealtimeTicket } from "./protocol"

const SECRET = "a-secret-that-is-long-enough-for-tests"

const workspace = newWorkspaceId()
const actor = newActorId()

const claims = {
  workspaceId: workspace,
  actorId: actor,
  teamIds: ["team-eng"],
} as const

describe("queue wakeups", () => {
  test("allows the sweeper to wake a workspace with no seq row", () => {
    expect(queueWakeupSchema.parse({ workspaceId: workspace, seq: 0 })).toEqual({
      workspaceId: workspace,
      seq: 0,
    })
  })
})

describe("realtime tickets", () => {
  test("binds the workspace, actor, team scope, and expiry", async () => {
    const ticket = await signRealtimeTicket(claims, SECRET, 100_000)
    const verified = await verifyRealtimeTicket(ticket, SECRET, workspace, 110_000)

    expect(verified).toEqual({
      workspaceId: workspace,
      actorId: actor,
      teamIds: ["team-eng"],
      issuedAt: 100_000,
      expiresAt: 160_000,
    })
  })

  test("rejects a ticket for another workspace", async () => {
    const ticket = await signRealtimeTicket(claims, SECRET, 100_000)

    await expect(
      verifyRealtimeTicket(ticket, SECRET, newWorkspaceId(), 110_000),
    ).resolves.toBeNull()
  })

  test("rejects an expired or forged ticket", async () => {
    const ticket = await signRealtimeTicket(claims, SECRET, 100_000)
    const [payload, signature] = ticket.split(".")
    const forged = `${payload}.${signature?.slice(1)}`

    await expect(verifyRealtimeTicket(ticket, SECRET, workspace, 160_000)).resolves.toBeNull()
    await expect(verifyRealtimeTicket(forged, SECRET, workspace, 110_000)).resolves.toBeNull()
  })

})
