import { describe, expect, test } from "bun:test"
import { newActorId, newTeamId } from "./ids"
import { can, isTeamScoped, type Action, type Principal } from "./policy"

const eng = newTeamId()
const ops = newTeamId()

function human(role: Principal["role"], teamIds: Principal["teamIds"] = "all"): Principal {
  return { kind: "user", actorId: newActorId(), role, teamIds }
}

function agent(scopes: readonly Action[], teamIds: Principal["teamIds"] = "all"): Principal {
  return { kind: "agent", actorId: newActorId(), role: "member", teamIds, scopes }
}

describe("human roles", () => {
  test("owners can do everything, including workspace management", () => {
    expect(can(human("owner"), "workspace:manage")).toBe(true)
    expect(can(human("owner"), "agent:manage")).toBe(true)
    expect(can(human("owner"), "issue:write", eng)).toBe(true)
  })

  test("admins manage people and teams but not the workspace itself", () => {
    expect(can(human("admin"), "workspace:manage")).toBe(false)
    expect(can(human("admin"), "member:manage")).toBe(true)
    expect(can(human("admin"), "team:manage", eng)).toBe(true)
  })

  test("members work on issues and nothing else", () => {
    expect(can(human("member"), "issue:read", eng)).toBe(true)
    expect(can(human("member"), "issue:comment", eng)).toBe(true)
    expect(can(human("member"), "member:manage")).toBe(false)
    expect(can(human("member"), "agent:manage")).toBe(false)
  })

  test("a principal without a membership can do nothing", () => {
    expect(can(human(null), "issue:read", eng)).toBe(false)
  })
})

describe("team scope", () => {
  test("a scoped member is limited to their teams", () => {
    const member = human("member", [eng])

    expect(can(member, "issue:write", eng)).toBe(true)
    expect(can(member, "issue:write", ops)).toBe(false)
  })

  test("team-scoped actions require a team", () => {
    expect(can(human("member"), "issue:write")).toBe(false)
  })

  test("workspace actions ignore team scope", () => {
    expect(can(human("admin", [eng]), "member:manage")).toBe(true)
  })

  test("only issue and team actions are team scoped", () => {
    expect(isTeamScoped("issue:read")).toBe(true)
    expect(isTeamScoped("team:manage")).toBe(true)
    expect(isTeamScoped("member:manage")).toBe(false)
    expect(isTeamScoped("workspace:manage")).toBe(false)
  })
})

describe("agent grants", () => {
  test("an agent gets exactly its granted actions", () => {
    const scoped = agent(["issue:read", "issue:comment"], [eng])

    expect(can(scoped, "issue:read", eng)).toBe(true)
    expect(can(scoped, "issue:comment", eng)).toBe(true)
    expect(can(scoped, "issue:write", eng)).toBe(false)
    expect(can(scoped, "issue:read", ops)).toBe(false)
  })

  test("an agent with an empty grant cannot act", () => {
    expect(can(agent([]), "issue:read", eng)).toBe(false)
  })

  test("an agent cannot exceed its role", () => {
    const overreaching = agent(["workspace:manage"])

    expect(can(overreaching, "workspace:manage")).toBe(false)
  })

  test("an agent cannot be expressed without a grant", () => {
    // @ts-expect-error an agent principal requires scopes
    const impossible: Principal = {
      kind: "agent",
      actorId: newActorId(),
      role: "member",
      teamIds: "all",
    }

    expect(impossible).toBeDefined()
  })
})
