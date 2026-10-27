# Setup

What to configure before the `dev` environment can be applied, and what is still
code rather than configuration.

## Credentials and identifiers

| What | Where it goes | Secret | Where to get it |
| --- | --- | --- | --- |
| Cloudflare account id | `TF_VAR_account_id` in `infra/envs/dev/deploy.env` | no | Cloudflare dashboard, account home |
| Cloudflare API token | `TF_VAR_cloudflare_api_token` in `infra/envs/dev/deploy.env` | yes | My Profile, API Tokens |
| Neon organization id | `TF_VAR_neon_org_id` in `infra/envs/dev/deploy.env` | no | Neon console, Account settings, Organization settings |
| Neon API key | `NEON_API_KEY` in `infra/envs/dev/deploy.env` | yes | Neon console, Account settings, API keys |
| R2 access key id | `AWS_ACCESS_KEY_ID` in `infra/envs/dev/deploy.env` | yes | R2 API token created after bootstrap |
| R2 secret access key | `AWS_SECRET_ACCESS_KEY` in `infra/envs/dev/deploy.env` | yes | R2 API token created after bootstrap |
| State backend config | `infra/envs/dev/backend.hcl` | no | Generated from `TF_VAR_account_id` in `deploy.env` by `task infra:init` |
| Dev hostname | `WORKERBEE_HOSTNAME` in `infra/envs/dev/deploy.env` | no | A bare hostname in a Cloudflare zone on the account |
| Smoke URL | `WORKERBEE_URL` for `task smoke:dev` | no | Defaults to `https://$WORKERBEE_HOSTNAME` |

`NEON_API_KEY` is read by the Neon provider directly. It is never a Terraform
variable, so it never enters state. The Neon role password does enter state, and
so does the same password inside Hyperdrive. Protect the state bucket.

The Cloudflare token needs, at minimum:

- Account: R2 Bucket, edit
- Account: Queues, edit
- Account: Hyperdrive, edit
- Account: Account Settings, read
- Zone: Zone, read
- Account: Workers Scripts, edit

The Workers Custom Domain resource creates the dev hostname through OpenTofu.
The token also needs Workers Scripts access for Wrangler deploys.

## PostHog (optional)

Set the PostHog project token in `.env.dev`. `task build` bakes it into the web bundle, and the deploy task sets it as a Worker secret for the API and hub. Leave `POSTHOG_KEY` empty to disable analytics, error tracking, and logs entirely.

| Variable | Used by | Notes |
| --- | --- | --- |
| `POSTHOG_KEY` | Web build, API, hub | Project token, starts with `phc_`. Publishable, but kept out of git |
| `POSTHOG_HOST` | Web build, API, hub | `https://us.i.posthog.com` or `https://eu.i.posthog.com` |
| `POSTHOG_API_KEY` | Web build | Personal API key with error tracking write and organization read scopes. Only used to upload source maps |
| `POSTHOG_PROJECT_ID` | Web build | Numeric project id. Only used to upload source maps |

The web app captures pageviews, exceptions, and identified users, and feature flags load in the browser through `useFeatureFlag`. Identifying a user sends their email and name to PostHog. The API and hub capture unhandled errors and send structured logs to PostHog Logs. Local runs and tests stay silent while the key is empty.

With `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` set, `task build` injects a chunk id into each web bundle and uploads hidden source maps to PostHog. Without them the build skips both steps, so CI needs no PostHog account. Worker bundles do not upload source maps yet.

## One-time bootstrap

The state bucket must exist before OpenTofu can store environment state. Store the deployment credentials in one ignored file so you do not re-enter them for each task.

```sh
cp infra/envs/dev/deploy.env.example infra/envs/dev/deploy.env
nano infra/envs/dev/deploy.env
chmod 600 infra/envs/dev/deploy.env
```

First, fill `TF_VAR_account_id` and `TF_VAR_cloudflare_api_token`. Then create the state bucket:

```sh
task infra:bootstrap
```

Create one R2 API token in the Cloudflare dashboard. Scope it to the `workerbee-tofu-state` bucket with Object Read and Write. Copy its Access Key ID and Secret Access Key into `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `deploy.env`. Cloudflare shows the secret only once. This is a one-time dashboard step. The routine deploy task reuses these credentials from the file.

Fill `TF_VAR_neon_org_id` and `NEON_API_KEY` in the same file. Then run:

```sh
task infra:init
task infra:apply
```

`task infra:init` generates `infra/envs/dev/backend.hcl` from the account id. The first apply creates two R2 buckets, two queues, one Neon project, and one Hyperdrive config. The Neon project is guarded by `prevent_destroy`. Add `WORKERBEE_HOSTNAME` to `deploy.env` when you are ready to deploy the Workers. See [Deploy the dev environment](DEPLOY.md) for the full sequence.

## Local development

The Taskfile wraps the local loop. Run once:

```sh
task setup
```

This copies `.env.dev.example` to `.env.dev`, generates an auth secret, installs
dependencies, starts Postgres on `127.0.0.1` only, applies migrations, and creates
the test database. If Postgres is already listening on `127.0.0.1:5432`, setup uses it
instead of starting Compose. Then:

```sh
task dev
```

The API runs on port 3001 and the web app on port 5173. Open
`http://localhost:5173`. Vite proxies `/api` and WebSocket upgrades to the API, so
cookies and the origin check use the web origin. `BETTER_AUTH_URL` must match the
origin you open. The Bun API hosts an in-memory local hub; its bounded buffer is
recreated from Postgres after a process restart, and clients recover through `/sync`.

`.env.dev` is gitignored and loaded by every task. It holds local service
values: database URLs, the auth secret, the auth origin, ports, and Postgres
settings. Cloud credentials do not belong there.

If you change `BETTER_AUTH_SECRET`, run `task db:reset-auth`, then sign in again. Better Auth
cannot decrypt keys created with the old secret.

Run `task --list` for everything. Common tasks include `task check`,
`task test:e2e`, `task db:migrate`, `task db:generate`, `task db:studio`,
`task db:reset`, `task design`, `task build`, `task infra:validate`,
`task infra:plan`, `task infra:apply`, `task infra:bindings`,
`task wrangler:dry-run`, `task deploy:dev`, `task smoke:dev`, and `task ops -- probe` for a
signed-out health check of the deployed stack. `task ops -- --help` lists the ops subcommands.

If you use podman, set `CONTAINER_CMD` in `.env.dev`, for example
`CONTAINER_CMD="podman compose"`. Without Task, the commands are in
`Taskfile.yml`.

The integration suites use `TEST_DATABASE_URL` and truncate every table in that
database. `task setup` creates `workerbee_test` for this.

## Changing the auth schema

Better Auth owns its tables. Regenerate them after adding a plugin:

```sh
task db:auth-schema
task db:migrate
```

Review the generated schema and migration before committing.

## Not configuration

These still do not exist. Providing credentials does not produce a working app.

- The account-generated bindings file and deployed API, hub, and web Workers.
  Wrangler configs and deploy tasks exist, but no Worker has been deployed yet.
- Boards and the command palette. Live updates work locally; queue delivery and
  the Durable Object deployment still need account resources and a deploy.
- Row level security policies. The repository wrapper and the isolation suite
  are in place; RLS is the database backstop that comes later.
- Changeset pruning. The log grows until a scheduled job lands.
