# Setup

What to configure before the `dev` environment can be applied, and what is still
code rather than configuration.

## Credentials and identifiers

| What | Where it goes | Secret | Where to get it |
| --- | --- | --- | --- |
| Cloudflare account id | `TF_VAR_account_id` or `infra/envs/dev/terraform.tfvars` | no | Cloudflare dashboard, account home |
| Cloudflare API token | `TF_VAR_cloudflare_api_token` | yes | My Profile, API Tokens |
| Neon organization id | `TF_VAR_neon_org_id` | no | Neon console, Account settings, Organization settings |
| Neon API key | `NEON_API_KEY` in the environment | yes | Neon console, Account settings, API keys |
| R2 access key id | `AWS_ACCESS_KEY_ID` | yes | R2 API token created after bootstrap |
| R2 secret access key | `AWS_SECRET_ACCESS_KEY` | yes | R2 API token created after bootstrap |
| State backend config | `infra/envs/dev/backend.hcl` | no | Copy from `backend.hcl.example`, fill the account id |
| Zone and hostname | later, when the web app deploys | no | Your Cloudflare zone |

`NEON_API_KEY` is read by the Neon provider directly. It is never a Terraform
variable, so it never enters state. The Neon role password does enter state, and
so does the same password inside Hyperdrive. Protect the state bucket.

The Cloudflare token needs, at minimum:

- Account: R2 Bucket, edit
- Account: Queues, edit
- Account: Hyperdrive, edit
- Account: Account Settings, read
- Zone: Zone, read

Add Workers Scripts when the API deploys, and DNS plus Access when the web app
gets a hostname.

## One-time bootstrap

The state bucket has to exist before any environment can use it, so it is created
with a local state file.

```sh
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...

tofu -chdir=infra/bootstrap init
tofu -chdir=infra/bootstrap apply \
  -var="account_id=$CLOUDFLARE_ACCOUNT_ID" \
  -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN"
```

Then create an R2 API token scoped to the state bucket with Object Read and
Write. Put its key id and secret in `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY`. OpenTofu cannot bootstrap its own state credentials,
so this one token is created by hand.

```sh
cp infra/envs/dev/backend.hcl.example infra/envs/dev/backend.hcl
$EDITOR infra/envs/dev/backend.hcl   # fill in the account id

export NEON_API_KEY=...
export TF_VAR_account_id=$CLOUDFLARE_ACCOUNT_ID
export TF_VAR_cloudflare_api_token=$CLOUDFLARE_API_TOKEN
export TF_VAR_neon_org_id=org-...

tofu -chdir=infra/envs/dev init -backend-config=backend.hcl
tofu -chdir=infra/envs/dev apply
```

The apply creates two R2 buckets, two queues, one Neon project, and one Hyperdrive
config. The Neon project is guarded by `prevent_destroy`.

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
`http://localhost:5173`. Vite proxies `/api` to the API, so cookies and the
origin check use the web origin. `BETTER_AUTH_URL` must match the origin you
open.

`.env.dev` is gitignored and loaded by every task. It holds local service
values: database URLs, the auth secret, the auth origin, ports, and Postgres
settings. Cloud credentials do not belong there.

If you change `BETTER_AUTH_SECRET`, run `task db:reset-auth`, then sign in again. Better Auth
cannot decrypt keys created with the old secret.

Run `task --list` for everything. The common tasks are `task check`,
`task test:e2e`, `task db:migrate`, `task db:generate`, `task db:studio`,
`task db:reset`, `task design`, `task build`, and `task infra:validate`.

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

- `wrangler.jsonc`, the generated bindings file, and the hub worker. The API
  has a Worker entry point, but it has never been deployed.
- Boards, the command palette, and live updates. The issue list and detail panel
  work against the API, but the hub and WebSocket are not built yet.
- Row level security policies. The repository wrapper and the isolation suite
  are in place; RLS is the database backstop that comes later.
- Changeset pruning. The log grows until a scheduled job lands.
