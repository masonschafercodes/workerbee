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

Local work needs no cloud credentials. Start Postgres 17:

```sh
docker run --rm -d --name workerbee-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=workerbee \
  postgres:17-alpine
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/workerbee
bun run --cwd packages/db migrate
```

Then run the API:

```sh
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export BETTER_AUTH_URL=http://localhost:3001
bun run --cwd apps/api dev
```

The integration suites run only when `TEST_DATABASE_URL` is set. They truncate
every table in the public schema, so point them at a separate database:

```sh
docker exec workerbee-pg createdb -U postgres workerbee_test
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/workerbee_test
bun test
```

## Changing the auth schema

Better Auth owns its tables. Regenerate them after adding a plugin, then review
the diff and generate a migration:

```sh
bunx --bun auth@1.7.13 generate --cwd packages/auth --config src/cli.ts \
  --output ../db/src/schema/auth.ts --adapter drizzle --dialect postgresql -y
bun run --cwd packages/db generate
bun run --cwd packages/db migrate
```

## Not configuration

These still do not exist. Providing credentials does not produce a working app.

- `wrangler.jsonc`, the generated bindings file, and the hub worker. The API
  has a Worker entry point, but it has never been deployed.
- The web app.
- Row level security policies. The repository wrapper and the isolation suite
  are in place; RLS is the database backstop that comes later.
- Changeset pruning. The log grows until a scheduled job lands.

Until those land, the `dev` apply provisions infrastructure only.
