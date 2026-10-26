# Workerbee agent guide

Last updated: 2026-10-26

A self-hosted, Linear-shaped issue tracker for one operator and their agents. Cloudflare provides
compute and realtime, Neon Postgres is the system of record, and OpenTofu owns infrastructure.

Read before changing behavior:

- [Plan](docs/PLAN.md): architecture, sync protocol, phases.
- [Design system](docs/DESIGN.md): tokens, component rules, accessibility.
- [Decisions](docs/adr/): choices that are expensive to reverse.
- [Glossary](docs/GLOSSARY.md): the words the codebase uses.
- [Setup](docs/SETUP.md): credentials and bootstrap.

## Current state

Phase 0. Sign-up, workspaces, membership, a tenant-scoped repository, bootstrap, and sync work
against Postgres. The design system and its gallery exist. `apps/web` has the product shell:
sign-in, workspace creation, issue list, detail panel, create issue, state and priority changes,
and comments. There is no `wrangler.jsonc`, no deployed Worker, no live updates, and no boards or
command palette yet.

## Setup

Requirements: Bun 1.4.4, Docker or podman, and OpenTofu 1.13 for infra work. The commands below
use `docker`; with podman, substitute `podman` and `podman exec`.

```sh
bun install

docker run --rm -d --name workerbee-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=workerbee \
  postgres:17-alpine

export DATABASE_URL=postgres://postgres:postgres@localhost:5432/workerbee
bun run --cwd packages/db migrate

export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export BETTER_AUTH_URL=http://localhost:5173

bun run --cwd apps/api dev   # terminal 1
bun run --cwd apps/web dev   # terminal 2
```

The web app proxies `/api` to port 3001. Set `BETTER_AUTH_URL` to the origin you open.

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | API, Drizzle CLI | Local Postgres in development |
| `BETTER_AUTH_SECRET` | API | At least 32 characters, enforced |
| `BETTER_AUTH_URL` | API | Origin used for cookies and CSRF |
| `TEST_DATABASE_URL` | Integration suites | Separate database, truncated by tests |

Never commit `.dev.vars`, `terraform.tfvars`, `backend.hcl`, or OpenTofu state. The credentials
and bootstrap order are in [Setup](docs/SETUP.md).

## Commands

| Task | Command |
| --- | --- |
| Fast gate | `bun run check` |
| Full gate | `TEST_DATABASE_URL=... bun run check` |
| Typecheck only | `bun run typecheck` |
| Tests | `bun test` |
| E2E only | `bun test packages/e2e` |
| API dev server | `bun run --cwd apps/api dev` |
| Web app | `bun run --cwd apps/web dev` |
| Design gallery | `bun run --cwd apps/design dev` |
| Gallery build | `bun run --cwd apps/design build` |
| Generate a migration | `bun run --cwd packages/db generate` |
| Apply migrations | `bun run --cwd packages/db migrate` |
| Infra format | `tofu fmt -recursive infra` |
| Infra validate | `tofu -chdir=infra/envs/dev init -backend=false && tofu -chdir=infra/envs/dev validate` |

Integration suites truncate every table in the public schema. Create a dedicated database:

```sh
docker exec workerbee-pg createdb -U postgres workerbee_test
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/workerbee_test
```

Regenerate Better Auth tables after changing plugins:

```sh
bunx --bun auth@1.7.13 generate --cwd packages/auth --config src/cli.ts \
  --output ../db/src/schema/auth.ts --adapter drizzle --dialect postgresql -y
```

## Repository map

| Path | Owns |
| --- | --- |
| `apps/api` | Hono routes, auth mount, tenant resolution, Worker and Bun entries |
| `apps/web` | Product shell: auth, workspace, issue list, detail, comments |
| `apps/design` | Component gallery, design review target |
| `packages/domain` | Ids, actors, roles, policy, issue and team rules. No IO |
| `packages/db` | Drizzle schema, migrations, `TenantDb`, isolation probes |
| `packages/e2e` | HTTP end-to-end suites against a real database |
| `packages/sync` | Changeset schema, apply, scoped fanout |
| `packages/auth` | Better Auth config and actor projection |
| `packages/ui` | Tokens and primitives, no product logic |
| `infra` | OpenTofu bootstrap, modules, environments |
| `docs` | Plan, ADRs, glossary, design, setup |

## Code style

- TypeScript is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
  `verbatimModuleSyntax`. Do not pass `undefined` to optional properties; spread conditionally.
- Use `unknown` at boundaries and parse it. Avoid `any`.
- Use const arrays plus union types instead of enums.
- Use branded ids from `@workerbee/domain`. Parse ids at the boundary; never cast a raw string in a
  handler.
- Files are kebab-case. Components use PascalCase exports. Prefer named exports.
- Comments explain why something is surprising. Delete comments that narrate the line below.
- No em dashes in code, comments, docs, or commits.
- Keep domain packages free of database, HTTP, and React imports.

## Database and tenancy

- Every tenant-owned table carries `workspace_id`. Reads go through `TenantDb`, which requires a
  workspace at construction. Do not query `db` directly in route handlers.
- Composite foreign keys tie team, state, issue, comment, and label rows to one workspace. Keep
  them when adding tables.
- Every mutation opens one transaction that writes the domain rows and appends the changeset. Never
  write a domain row outside that path.
- Adding a repository method means adding a probe in `packages/db/src/tenant-probes.ts`. The
  isolation suite runs every listed probe with a foreign workspace. It cannot detect a method you
  forget to list.
- Migrations are generated and incremental. Never edit one that has been applied. Apply migrations
  to a clean database before committing: Drizzle can emit a foreign key before the unique
  constraint it references.
- Use a table-level `unique()` when a composite foreign key targets those columns.
- `packages/db/src/schema/auth.ts` is generated by the Better Auth CLI. Do not hand-edit it.
- `workspace` is an alias for Better Auth's `organization` table. Product code and docs say
  workspace.

## Auth and authorization

- Better Auth owns authentication. Do not write sessions, password hashing, API key storage, or
  OAuth flows.
- Authorization is ours: `packages/domain/policy.ts`. Unknown roles deny. Agents get an explicit
  grant that can only narrow their role.
- Signup projects a `user` into `actor` through a Better Auth hook. Keep the actor id space.
- Workspace creation goes through `POST /api/v1/workspaces` so the domain slug rule applies.
  Better Auth's own organization create and update routes are blocked on purpose.
- Never trust a workspace id or actor id from a request body. Resolve them from the session and the
  `x-workerbee-workspace` header.

## API rules

- Resolve tenant context with `resolveTenant`. Require the workspace header.
- Validate request bodies before touching the database. Map `NotFoundError` to 404 and
  `ConflictError` to 409 through `app.onError`.
- Unsafe `/api/v1` requests are origin checked. Keep new cookie-authenticated mutations behind it.
- Bump `PROTOCOL_VERSION` only when an old client cannot read the new wire shape.

## Agent surface

- Agents are external clients. Never add a model call to the request path.
- Tools are task-shaped, not a REST mirror. Prefer one call that answers a question over three that
  return rows.
- Agent mutations must take an idempotency key. Reads take a `since` cursor where it makes sense.
- Any new response renderer needs a token budget test. Adding a field is a budget decision.
- Agent code must not poll. Use wakeups, webhooks, or `work.queue`.

## UI rules

- Use semantic tokens only. `packages/ui/src/tokens.test.ts` fails on raw hex, rgb, hsl, or
  oklch in components. The lint only scans `components/**/*.tsx`; the rule covers all UI code.
- `packages/ui` sits outside the app root. Tailwind only scans it because `styles.css` declares
  `@source "./**/*.{ts,tsx}"`. Keep that line.
- Compose Radix primitives for anything with focus management. Do not reimplement a focus trap.
- Icon buttons require `label`. Tooltips supplement a label, never replace it.
- New or changed components need a gallery example with variants and states.
- Check keyboard use, axe in light and dark, and 390px width with no horizontal scroll.
- Status and priority use shape plus color. Never color alone.
- Do not use arbitrary color utilities. Dimensions may use the scale. A local explicit size is
  acceptable for fixed control geometry the scale cannot express, such as the 18px switch track or
  the 5px agent radius.

## Infrastructure

- OpenTofu owns topology. Wrangler will own deploys. Do not create Cloudflare resources by hand.
- Durable Object classes are created by Wrangler migrations, not by OpenTofu.
- The Neon project has `prevent_destroy`. Do not remove it casually.
- Secrets never enter OpenTofu state. The database credential is the one exception because Hyperdrive
  takes it inline. Treat state as sensitive.
- Do not run `tofu init -upgrade` in CI. Review plans that touch the Neon project.
- Provider lock files are generated by `tofu init`. Commit them; do not edit them.

## Testing

- Colocate unit tests as `*.test.ts`. HTTP end-to-end suites live in `packages/e2e`
  and require `TEST_DATABASE_URL`.
- Test behavior, not implementation. A test that cannot fail when the feature breaks is not a test.
- Reproduce a bug in a user-shaped path before fixing it.
- UI verification is blackbox: gallery or product flow, keyboard, axe, screenshots at 390px
  and 1280px.
- Do not mock Postgres. Integration suites run against a real database and truncate it.
- The token lint and the listed tenant probes are gates. A new repository method escapes the probe
  suite until you add it, so the probe list is part of the change. Do not weaken either gate.

## Definition of done

- `bun run check` passes. With `TEST_DATABASE_URL` set, the integration suites pass too.
- New repository methods have isolation probes.
- New UI components have gallery examples and an axe pass in both themes.
- Schema changes have a generated migration that applies to a clean database.
- Docs, glossary, or an ADR are updated when a behavior or term changed.
- Generated files are regenerated, not edited.
- New environment variables are documented in [Setup](docs/SETUP.md).
- The diff contains no secrets and no stray debug output.

## Commits

Use conventional commits. Keep a change with its migration, tests, and docs. Never add an agent
name as co-author.

After code changes, run the `code-reviewer` and `comment-sicko` subagents on the diff. Resolve or
explicitly reject their findings before committing.

Update this file when commands or conventions change, and bump the date at the top.
