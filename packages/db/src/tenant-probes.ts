import type { ActorId, TeamId, WorkspaceId } from "@workerbee/domain"
import type { TenantDb } from "./tenant"

/**
 * A complete set of another workspace's ids. Probes receive these and must
 * either return nothing that mentions them or reject outright.
 */
export type TenantFixture = {
  readonly workspaceId: WorkspaceId
  readonly actorId: ActorId
  readonly teamId: TeamId
  readonly stateId: string
  readonly issueId: string
  readonly commentId: string
  readonly labelId: string
}

export type TenantProbe = {
  readonly name: string
  readonly expect: "no-leak" | "rejects"
  readonly run: (tenant: TenantDb, foreign: TenantFixture) => Promise<unknown>
}

/**
 * Every repository entry point a caller can reach gets a probe here. Adding a
 * method without a probe is the one thing this file cannot catch, so keep it
 * next to the repository and add one with each new method.
 */
export const tenantProbes: readonly TenantProbe[] = [
  {
    name: "bootstrap",
    expect: "no-leak",
    run: (tenant) => tenant.bootstrap(),
  },
  {
    name: "listIssues",
    expect: "no-leak",
    run: (tenant) => tenant.listIssues(),
  },
  {
    name: "issueById",
    expect: "no-leak",
    run: (tenant, foreign) => tenant.issueById(foreign.issueId),
  },
  {
    name: "commentsForIssue",
    expect: "no-leak",
    run: (tenant, foreign) => tenant.commentsForIssue(foreign.issueId),
  },
  {
    name: "listLabels",
    expect: "no-leak",
    run: (tenant) => tenant.listLabels(),
  },
  {
    name: "labelsForIssue",
    expect: "no-leak",
    run: (tenant, foreign) => tenant.labelsForIssue(foreign.issueId),
  },
  {
    name: "latestSeq",
    expect: "no-leak",
    run: (tenant) => tenant.latestSeq(),
  },
  {
    name: "changesSince",
    expect: "no-leak",
    run: (tenant) => tenant.changesSince(0, 500),
  },
  {
    name: "updateIssue",
    expect: "rejects",
    run: (tenant, foreign) =>
      tenant.updateIssue(foreign.issueId, { title: "hijacked" }, foreign.actorId),
  },
  {
    name: "addComment",
    expect: "rejects",
    run: (tenant, foreign) =>
      tenant.addComment(foreign.issueId, "hijacked", foreign.actorId),
  },
  {
    name: "createIssue with a foreign team",
    expect: "rejects",
    run: (tenant, foreign) =>
      tenant.createIssue({
        teamId: foreign.teamId,
        stateId: foreign.stateId,
        title: "hijacked",
        creatorId: foreign.actorId,
      }),
  },
  {
    name: "createLabel with a foreign team",
    expect: "rejects",
    run: (tenant, foreign) =>
      tenant.createLabel({
        teamId: foreign.teamId,
        name: "hijacked",
        color: "#d73a4a",
        actorId: foreign.actorId,
      }),
  },
  {
    name: "updateLabel with a foreign id",
    expect: "rejects",
    run: (tenant, foreign) =>
      tenant.updateLabel(foreign.labelId, { name: "hijacked" }, foreign.actorId),
  },
  {
    name: "deleteLabel with a foreign id",
    expect: "rejects",
    run: (tenant, foreign) => tenant.deleteLabel(foreign.labelId, foreign.actorId),
  },
  {
    name: "attachLabel with a foreign issue",
    expect: "rejects",
    run: (tenant, foreign) =>
      tenant.attachLabel(foreign.issueId, foreign.labelId, foreign.actorId),
  },
  {
    name: "attachLabel with a foreign label",
    expect: "rejects",
    run: async (tenant, foreign) => {
      const [issue] = await tenant.listIssues()

      if (issue === undefined) {
        throw new Error("the probe needs a local issue")
      }

      return tenant.attachLabel(issue.id, foreign.labelId, foreign.actorId)
    },
  },
  {
    name: "detachLabel with a foreign issue",
    expect: "rejects",
    run: (tenant, foreign) =>
      tenant.detachLabel(foreign.issueId, foreign.labelId, foreign.actorId),
  },
  {
    name: "detachLabel with a foreign label",
    expect: "rejects",
    run: async (tenant, foreign) => {
      const [issue] = await tenant.listIssues()

      if (issue === undefined) {
        throw new Error("the probe needs a local issue")
      }

      return tenant.detachLabel(issue.id, foreign.labelId, foreign.actorId)
    },
  },
]
