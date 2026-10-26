# Workerbee plan

A self-hosted issue tracker in the shape of Linear, built for one operator and their agents.
It is not a product: no billing, no signup, no per-customer onboarding, no support contract.

This document is the proposal to argue with before any code lands. Decisions live in
`docs/adr/`. Vocabulary lives in `GLOSSARY.md`.

## Scope

**In scope for v1**

- Workspaces, teams, members, and agent principals.
- Issues with states, priority, assignee, labels, relations, comments, and history.
- List and board views with filters, plus a command palette and keyboard-first navigation.
- Live updates: another browser or an agent changes something, you see it immediately.
- Agent tooling: a small, task-shaped, batch-capable, delta-capable tool surface with hard
  token budgets and per-agent spend accounting.
- Infrastructure in code with OpenTofu. TypeScript and Bun everywhere.

**Out of scope for v1**

- Billing, public signup, marketing pages, per-tenant SSO, SLA.
- Mobile apps, i18n, rich block editor, Gantt and timeline views, importers.
- Hosting agent runtimes inside Workerbee. Agents are external clients over MCP, HTTP, and webhooks.
- Running on anything other than Cloudflare. A portable Docker Compose target is a later phase.

**Alternatives not taken.** Adopting an existing open-source Linear clone (Plane, Huly) would
start from someone else's domain model, runtime, and opinion about agents. The agent surface is the
point, so the issue model is ours. A generic workflow engine is also out: five state categories and
a per-team state list cover real use.

## Decisions at a glance

| Area | Decision | Rejected alternative | ADR |
| --- | --- | --- | --- |
| System of record | Postgres, reached through Hyperdrive | Durable Object SQLite per workspace | 0001 |
| Database host | Managed Postgres (Neon-compatible) for v1 | Self-hosted VM with WAL archiving to R2 | 0001 |
| Realtime | One Durable Object per workspace, WebSocket fanout, queue-fed | Polling, ElectricSQL, PartyKit | 0001, 0003 |
| Auth | Better Auth 1.5 (MIT) for authentication, our policy module for authorization | Zitadel, Keycloak, Authentik, hand-rolled | 0002 |
| Client sync | Bootstrap snapshot plus pruned changeset log with a per-workspace `seq` | CRDTs, event sourcing, per-query sync | 0003 |
| Agent surface | One tool registry, two transports (MCP and HTTP), token budgets in CI | REST 1:1 as tools, GraphQL, raw SQL tool | 0004 |
| Infra | OpenTofu owns topology, Wrangler owns deploys, generated bindings file | Tofu owns workers too, or Wrangler owns everything | 0005 |
| Frontend | React 19, TanStack Router, Tailwind, Radix, `cmdk` | Next.js, server components | - |
| Local store | TanStack Query cache that applies changesets, upgradeable to IndexedDB store | Full Linear-style LSE on day one | - |

## Architecture

```
              ┌─────────────────────────────┐
  browser ────┤  web (Workers static assets)│
     │        └─────────────────────────────┘
     │ WS (ticket)                     HTTP (session cookie)
     ▼                                      ▼
┌──────────────────────┐            ┌──────────────────────────┐
│ WorkspaceHub         │◀── queue ──│ api worker (Hono)        │
│ Durable Object       │            │  - REST + /sync + /batch │
│ per workspace        │            │  - /mcp + /agent/v1      │
│ - sockets, seq gaps  │            │  - /api/auth/* (Better)  │
│ - changeset buffer   │            └───────┬──────────┬───────┘
└──────────────────────┘                    │          │
                                     Hyperdrive     Queues / R2
                                            │          │
                                     ┌──────▼───┐  ┌───▼─────────────┐
  agent ── MCP or HTTP ─────────────▶│ Postgres │  │ webhooks, mail, │
  agent ── NDJSON sync ─────────────▶└──────────┘  │ agent wakeups   │
                                                   └─────────────────┘
```

**Write path.** One Postgres transaction per request. The transaction writes the domain rows,
appends a `changeset` row and its `change` rows, and increments the workspace `seq`. After
commit, the API enqueues `{workspaceId, seq}`. The queue consumer calls the workspace hub, which
fans the changeset out to sockets and keeps a bounded buffer in its own SQLite storage.

The hub is not on the write path. If it is down or the queue lags, writes still commit and
clients catch up by pulling `/sync?since=`. That property is worth more than a few milliseconds
of latency.

**Read path.** Clients bootstrap a snapshot at a `seq`, then apply changesets. The same
changeset stream feeds humans over WebSocket and agents over HTTP as NDJSON. One protocol,
two shapes.

## Domain model

Postgres, one schema. Every tenant-owned table carries `workspace_id` as the first column of
every index. Internal ids are UUIDv7. Human-facing issue keys are `TEAM-123`.

| Table | Purpose |
| --- | --- |
| `workspace` | The tenant. Slug, name, settings, `seq`, `seq_updated_at`. |
| `actor` | Identity registry: `id` and `kind` (`user` or `agent`). Display data joins the detail table. |
| `user` | Better Auth principals. Humans and agent service users. |
| `agent` | Agent details for a service user: handle, owner, scopes, budget, status. |
| `member` | Better Auth org membership, one row per actor per workspace, with role. |
| `team` | Team inside a workspace, with `key` (`ENG`) and issue counter. |
| `team_member` | Team scope and team role. Narrower than workspace membership. |
| `workflow_state` | Named state per team with a category (`backlog`, `unstarted`, `started`, `done`, `canceled`). |
| `issue` | Title, body, state, priority, assignee, project, cycle, parent, estimate, version. |
| `issue_label`, `label` | Many-to-many labels. |
| `issue_relation` | `blocks`, `blocked_by`, `relates`, `duplicate`. |
| `comment` | Threaded comments with `edited_at` and soft delete. |
| `project`, `milestone`, `cycle` | Planning containers. Cycles are time-boxed per team. |
| `view` | Saved filter, private or shared. |
| `notification` | Per-actor inbox row with reason and read state. |
| `attachment` | R2 object reference with checksum and size. |
| `changeset`, `change` | Replication log. Pruned after 7 days. |
| `agent_run` | One agent attempt at an issue: status, budget, usage, log pointer. |
| `tool_call` | Agent tool telemetry: tool, tokens in and out, latency, outcome. |
| `webhook` | Agent or CI subscription with HMAC secret and filters. |

`actor` exists so assignments, comments, and history reference one id space. A human and an
agent are both `actor` rows, backed by `user` and `agent` detail tables. This avoids polymorphic
foreign keys in every hot table and keeps "who did this" a single column.

`issue.version` increments on every write. Clients and agents send `If-Match` to avoid lost
updates. Agent writes are frequently retried, so idempotency keys are mandatory, not optional.

## Sync and live updates

A `changeset` is one write transaction. It has a `seq`, an actor, a timestamp, and a list of
`change` rows. Each change names an entity, an id, an operation, and only the changed fields.

```
{ seq: 4211, actor: "act_7f...", at: "...",
  changes: [
    { entity: "issue", id: "iss_01...", teamId: "team_01...", op: "update",
      patch: { "stateId": "st_done", "version": 9 } },
    { entity: "comment", id: "cmt_9a...", teamId: "team_01...", op: "insert",
      patch: { "issueId": "iss_01...", "body": "..." } }
  ] }
```

- **Bootstrap**: `GET /api/v1/bootstrap?workspace=slug` returns teams, states, labels, members,
  and issue summaries at `seq`. Issue bodies and comments load on demand.
- **Live**: the client asks `POST /api/v1/realtime-ticket`, then opens a WebSocket to the
  workspace hub with the short-lived ticket. Tickets avoid cross-worker cookie and CSRF trouble.
- **Catch-up**: the hub replays buffered changesets after `since`. A gap older than the buffer
  returns `reset`, and the client re-bootstraps. Gaps are normal, not an error path.
- **Scoped fanout**: every change carries a `teamId` (null only for workspace-level entities).
  The realtime ticket carries the actor's team scope, and the hub drops changes outside it, so a
  restricted actor never sees a hidden team's activity.
- **Optimistic writes**: the client assigns a temporary id, sends `clientMutationId`, and
  reconciles when the changeset echoes back. The server never trusts client ids.
- **Pruning**: the changeset table keeps 7 days. Long-offline clients re-bootstrap, which is
  cheap because a bootstrap is one snapshot query plus one page of summaries.
- **Presence and typing**: hub memory only, never persisted. Never in the changeset log.

Text is last-write-wins in v1. If concurrent editing of a long description becomes painful,
description bodies move to Yjs in a later phase. Do not pre-build that.

**Why not the full Linear engine on day one.** The local store is the highest-risk part, and a
self-hosted tool for one team does not need offline writes in week one. The client keeps a
normalized map inside TanStack Query, applies changeset patches to it, and exposes a
`SyncStore` interface. If the app ever needs offline or instant boot, an IndexedDB-backed store
implements the same interface. The UI never learns which one it is talking to.

## Agent surface and cost model

An agent is a first-class actor: it can be assigned an issue, comment, transition state, and be
@-mentioned. It has its own credentials, scopes, and budget.

**Two transports, one registry.** `packages/agent-tools` defines every tool once: input schema,
permission check, handler, and renderer. `/mcp` (OAuth) and `/agent/v1` (API key) are thin
adapters over the same dispatcher. Permission checks, idempotency, budget enforcement, and
telemetry are written once and cannot drift between transports.

**v1 tool surface** (small on purpose):

| Tool | What it does |
| --- | --- |
| `workspace.info` | Vocabulary, states, my identity, current `seq`, digest for prompt caching. |
| `issues.search` | Filtered, sorted, field-masked list. Returns compact rows. |
| `issues.get` | One or more issues, optionally with comments and relations, `since` aware. |
| `issues.create` | Create one issue. |
| `issues.update` | Patch one issue or many, `If-Match` aware. |
| `issues.comment` | Comment, with idempotency key. |
| `issues.relate` | Add or remove relations and labels in one call. |
| `work.queue` | "What should I do next", computed server-side. |
| `changes.pull` | Delta feed with entity filters and a cursor. |
| `context.bundle` | Token-bounded rendering of everything relevant to one issue. |
| `events.watch` / `events.unwatch` | Wakeups by webhook or MCP notification, with filters. |
| `usage.report` | Agent reports token usage so the budget stays honest. |

**Cost rules.** Agent cost is dominated by round trips and context bloat, not by bytes on the
wire. These rules exist to keep one task to a handful of calls:

1. No polling. `events.watch` and `work.queue` replace the loop.
2. One call per task. A tool that answers a question beats three tools that return data.
3. Deltas, not snapshots. Every read response carries `seq` and accepts `since`.
4. Batch mutations. `issues.update` and `issues.relate` take arrays.
5. Compact by default. Rows render as TSV, mutations as JSON. Field masks on reads.
6. Stable short refs. Agents see `ENG-123`, never UUIDs.
7. Idempotency keys on every mutation. Retries must not duplicate comments.
8. Server-side search, filters, and sorting. Never ship the workspace so the model can filter.
9. Response envelope: `_meta: { seq, etag, est_tokens, truncated, next }`.
10. `304` on unchanged bundles via `ETag`, so a re-read costs zero tokens.

**Token budgets as a test.** Each renderer has a golden fixture and an asserted token ceiling in
CI. A change that inflates `work.queue` from 900 to 2400 tokens fails the build.

| Response | Budget |
| --- | --- |
| `work.queue`, 10 issues | 1200 |
| `issues.get`, 1 issue + 20 comments | 2500 |
| `context.bundle` | caller-supplied, default 4000 |
| `issues.update`, 10 issues | 400 |
| `changes.pull`, 100 changes | 3000 |

**Delegation loop.**

1. A human assigns an issue to an agent, or mentions it in a comment.
2. The API writes the assignment changeset and enqueues a wakeup with the issue ref.
3. The agent calls `context.bundle` with a token budget, does the work, and reports back with
   idempotent `issues.update` and `issues.comment` calls.
4. The human watches progress live, because every agent write is a changeset like any other.
5. `agent_run` closes with usage recorded. Budget exhausted means the run stops and the issue
   returns to the human with a comment explaining why.

**Cost accounting.** Every tool call writes a `tool_call` row. A workspace dashboard shows spend
per agent, per day, and per issue. Budgets are enforced before the call and reconciled after
`usage.report`. The point is to make a runaway loop impossible, not to bill anyone.

## Auth and tenancy

**Authentication is Better Auth.** It is MIT, TypeScript, runs on Workers, and covers the part
we refuse to write: password hashing, sessions, passkeys, 2FA, API keys, and an OAuth 2.1
authorization server for MCP clients. `organization` maps to our workspace. `apiKey` covers
agents and CI. `mcp` plus `jwt` covers external MCP clients with CIMD. An agent is a Better Auth
user with `isAgent: true` and no credential provider, created through an admin endpoint. The
`actor` projection gives it a domain id, and `apiKey` gives it a credential.

**Authorization is ours.** Team scope, private teams, issue visibility, and agent scopes are
product semantics, not auth plumbing. They live in `packages/domain/policy` as pure functions
over `(actor, workspace, team, issue, action)`. Better Auth org roles are coarse: `owner`,
`admin`, `member`. That is not enough to model "an agent may comment on `ENG` but not move
`OPS` issues".

**Tenancy enforcement.** Three layers, because one is not enough:

1. `WorkspaceId` is a branded type. Repositories do not accept plain strings.
2. Every query goes through a `TenantDb` wrapper that requires the workspace and injects it.
3. Postgres row level security as a backstop, with `SET LOCAL app.workspace_id` inside the
   transaction. Hyperdrive pools connections, so the setting must be transaction-local.

A generated test suite calls every repository method with a foreign workspace id and asserts an
empty result or a rejection. Adding a repository method without an isolation test fails CI.

## Frontend

React 19, TanStack Router, Tailwind v4, Radix primitives, `cmdk` for the palette, `dnd-kit` for
boards, TanStack Virtual for long lists. Markdown with a sanitizer, not a block editor.

The quality bar is Linear's: dense three-pane layout, instant keyboard navigation, no spinner
between views, a palette that does everything. Concretely:

- `j` and `k` move, `c` creates, `cmd+k` opens the palette, `?` shows the map.
- Issue detail opens as a panel over the list, not a route change that refetches.
- Every mutation is optimistic. The optimistic value is replaced by the server changeset, not
  by a refetch.
- Skeletons only on first load. After that, stale data is better than empty data.
- WCAG AA contrast, visible focus, full keyboard operation, `prefers-reduced-motion` respected.

## Infrastructure

**Ownership split.** OpenTofu creates account-level resources: R2 buckets, queues, Hyperdrive
configs, DNS, Access policies, and rate limit rules. It writes their ids to
`infra/generated/bindings.<env>.jsonc`. The config generator merges that file into Wrangler
configs. One owner per resource, no drift.

Durable Object namespaces are the exception, and the reason is mechanical: a DO class only exists
once a worker migration creates it, and that migration must ship with the script. So Wrangler owns
the hub script and its migrations. The API worker binds the class by name with `script_name`, so
tofu never needs the namespace id.

```
infra/
  bootstrap/          state bucket, API token, first apply
  modules/
    worker/           script, route, assets
    queue/            main queue and dead letter queue
    postgres-neon/    Neon project, branch, database, role
    hyperdrive/       config, optional VPC service
    storage/          R2 buckets and lifecycle
    edge/             DNS, Access, rate limits
  envs/dev/
  envs/prod/
  generated/          committed bindings files
```

State lives in R2 with `use_lockfile = true` (native conditional-write locking). Environments
are `dev` and `prod` from the same modules. CI validates OpenTofu without account credentials and
runs Wrangler dry-runs. Operators run `task infra:plan` against remote state before applying.
`task deploy:dev` checks that the final state-backed plan is empty. Do not put provider or state
credentials in CI.

**Application secrets stay out of tofu state.** API keys, webhook HMAC secrets, and session keys go
through `wrangler secret bulk` from the deploy environment or a password manager. The one exception is the Hyperdrive
origin string: Hyperdrive takes the database credential inline, so it lands in state. Treat the
state bucket as sensitive, encrypt it, and scope the API token that can read it. A secret in state
is a secret on every laptop that ran `tofu plan`, so do not add a second exception.

**Postgres runs outside Cloudflare.** Cloudflare has no durable block storage for a database, and
Durable Object SQLite is capped at 10 GB per object with no ad-hoc SQL. For v1, Postgres is a Neon
project created by OpenTofu, reached over TLS through Hyperdrive. Backups, patching, and failover
are the provider's job, which is the right trade for a one-operator deployment.

`modules/postgres-neon` owns the project, its root branch, database, and role, and outputs the
host, user, and password that the Hyperdrive module consumes. No connection string is split by
hand. `prevent_destroy` is set, so `tofu destroy` on an environment fails before it deletes data.
The Neon API key is read from `NEON_API_KEY` and never becomes a variable. Two cautions from the
provider docs: `org_id` is mandatory, and `tofu init -upgrade` stays out of CI because a provider
major change can plan a project replacement.

Moving to a self-hosted VM with WAL archiving to R2 costs a module change, Workers VPC wiring, and
a new connection string. Application code does not change, because it reads one connection through
one adapter.

The application gets its connection through one adapter: the Hyperdrive binding in production, a
direct URL in local development. Local Postgres runs in Docker Compose and Hyperdrive's
`localConnectionString` points at it, so there is no second schema or migration path.

Hyperdrive query caching is disabled. A cached `SELECT` would serve a stale row immediately after
a commit, and the sync contract depends on reads reflecting the last `seq` the client saw.

## Repo layout

```
workerbee/
  apps/
    web/          React SPA, deployed as Workers static assets
    api/          Hono worker: REST, sync, MCP, agent HTTP, Better Auth
    hub/          Durable Object worker: workspace fanout
  packages/
    domain/       Entities, invariants, policy, state machines
    db/           Drizzle schema, migrations, repositories, TenantDb
    contracts/    Zod schemas for REST, changesets, and tools
    sync/         Changeset types, patch application, seq logic
    agent-tools/  Tool registry, renderers, token budgets
    auth/         Better Auth config and actor projection
    ui/           Design system
    config/       tsconfig, lint, tailwind, test setup
  infra/          OpenTofu, generated bindings
  docs/           Plan, ADRs, glossary
  scripts/        Dev and release scripts
```

Bun workspaces with `bun --filter`. No Turbo unless build times demand it. Migrations run as an
explicit step, never on worker boot.

## Quality gates

- Unit tests for domain and policy. Fast, no network.
- Worker integration tests with `@cloudflare/vitest-pool-workers` against local Postgres and
  Miniflare Durable Objects.
- Playwright end to end against a deployed `dev` environment, using two browser contexts to prove
  live updates.
- Tenant isolation suite, generated from the repository registry.
- Token budget suite for every agent renderer.
- `tofu plan` cleanliness and a `wrangler deploy --dry-run` in CI.
- A restore drill: dump prod, restore into a scratch database, run the app against it.

## Current phase

**Phase 1, core loop.** Phase 0 is complete. Landed: workspaces, teams, membership, issues,
workflow states, priorities, comments, changesets, `/sync`, the hub WebSocket, and two-way live
updates. The dev environment is deployed at the configured hostname. Agent actors exist in the
domain and policy, with no agent-facing surface yet.

Phase 1 still needs:

- Labels and issue relations in the repository, changesets, sync, and UI. The label tables exist.
- A board view, keyboard navigation, and the command palette.
- The exit check between two browsers: one issue moves and one comment appears without a refresh.

This section is the source of truth for phase status. Update it when a slice lands.

## Phases

Sizes are effort, not calendar. Phases 3 onward assume the earlier exit criteria hold.

**Phase 0, skeleton (S).** Monorepo, Bun workspaces, lint and test setup. OpenTofu bootstrap
plus `dev` environment, including the Neon project. Docker Compose Postgres locally. One API
worker with a health route, one SPA route, migrations pipeline, Better Auth sign-in, CI.
*Exit: I sign in on a deployed URL and see an empty workspace.*

**Phase 1, core loop (L).** Workspaces, teams, members, agents as actors. Issues, states,
comments, labels, relations. List and board with keyboard navigation and palette. Changesets,
`seq`, `/sync`, hub WebSocket, optimistic mutations. Two-way live updates.
*Exit: two browsers, one issue moves and one comment appears without a refresh.*

**Phase 2, planning (M).** Projects, cycles, milestones, saved views and filters, inbox and
notifications, full-text search, issue history UI.
*Exit: a week of work is planned, triaged, and reviewed without leaving the app.*

**Phase 3, agents (L).** API keys, MCP OAuth, tool registry, compact renderers, batch and delta
tools, context bundles, wakeups and webhooks, budgets, `agent_run` UI, spend dashboard.
*Exit: an agent takes an assigned issue to done in 6 calls or fewer and under 8k tokens, and the
human sees each step live.*

**Phase 4, hardening (M).** Presence, attachments, rate limits, audit log, backups, restore
drill, structured logs and traces, error budgets, tenant isolation fuzzing.
*Exit: restore a backup into a fresh environment and lose nothing.*

**Phase 5, portability (M, optional).** A Docker Compose target: Postgres, API on Node or Bun,
SSE instead of Durable Objects behind the same sync interface.
*Exit: the same image runs on a VPS with no Cloudflare account.*

## Risks

| Risk | Mitigation |
| --- | --- |
| Sync engine scope creep | Changeset patch application into the query cache first. IndexedDB only behind the same interface, only if needed. |
| Postgres round-trip latency from Workers | Hyperdrive, single region, few queries per request, no chatty ORM patterns. A request that needs eight queries is a design bug. |
| Durable Object + WebSocket + auth in local dev | Build the WS handshake in Phase 1, not Phase 4. Smoke test it in CI with Miniflare. |
| Agent OAuth complexity | Ship API keys first. MCP OAuth is a Phase 3 later step, not a blocker. |
| Better Auth schema drift | Pin the version, wrap the adapter, generate the schema from the installed version, run its migrations in the same pipeline as ours. |
| Tofu and Wrangler drift | Generated bindings plus a CI check that fails when the plan is not empty. |
| Neon provider upgrade replaces the project | Pin the provider, never run `tofu init -upgrade` in CI, keep `prevent_destroy`, and review plans that touch the project. |
| Realtime fanout cost | One object per workspace, not per issue. Self-hosted scale makes this a non-issue, so measure before optimizing. |
| Per-workspace `seq` row contention | Fine below roughly 50 writes per second per workspace. If exceeded, shard the counter per team and merge by timestamp. |

## Settled decisions

| Question | Answer | Consequence |
| --- | --- | --- |
| Agent runtime | External clients over MCP, HTTP, and webhooks | Workerbee never schedules model calls. Phase 3 is the tool surface, not an agent runtime. |
| Postgres host | Neon project created by OpenTofu, through Hyperdrive | Automated backups and patching are not our problem. Moving to a VM is a module change plus Workers VPC. |
| Scale target | Under 10 workspaces, 100 actors, and 50k issues per workspace | Bootstrap may send every issue summary. Revisit if a workspace passes 50k issues. |
| Workspace routing | Path-based, `/w/<slug>/...` | One cookie, one origin. Subdomains are a later addition. |
| Issue-level permissions | Deferred. Workspace roles plus team scope in v1, private teams in Phase 4 | The policy module starts with team scope only. |

Revisit a decision when a change would make it expensive to reverse. Only the Postgres host is
expensive once data exists.

## Immediate next steps

1. Add labels and issue relations through the repository, changesets, sync, and UI.
2. Build the board view, keyboard navigation, and the command palette.
3. Verify the Phase 1 exit in two browsers: move an issue and post a comment, both without a
   refresh.
4. Start Phase 2 once Phase 1 exits.
