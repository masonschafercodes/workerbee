# Deploy the dev environment

Use this guide after [bootstrapping OpenTofu state](SETUP.md#one-time-bootstrap). The deploy task creates the dev infrastructure, deploys the Workers, and attaches the hostname. It then runs a live-update smoke test.

## Prepare credentials

Run `task setup` to create `.env.dev` and a Better Auth secret. Keep Cloudflare and Neon credentials out of `.env.dev`.

Copy the deploy credential template and fill it once:

```sh
cp infra/envs/dev/deploy.env.example infra/envs/dev/deploy.env
nano infra/envs/dev/deploy.env
chmod 600 infra/envs/dev/deploy.env
```

The Taskfile loads this ignored file for infrastructure and deployment tasks. It stores the Cloudflare account id and token, the Neon organization id and API key, the R2 state credentials, and `WORKERBEE_HOSTNAME`. Keep the file private and never commit it.

The task generates `infra/envs/dev/backend.hcl` from the account id. You only need to edit `deploy.env` again when a credential or hostname changes.

## Deploy and smoke test

Run the deploy task:

```sh
task deploy:dev
```

The task applies the base infrastructure, renders Wrangler configs from OpenTofu outputs, migrates Neon, and deploys the hub, API, and web Workers. It then creates the Cloudflare custom domain through OpenTofu. The task verifies live updates at `https://$WORKERBEE_HOSTNAME`. If you change a hostname, the task keeps the old API origin until OpenTofu attaches the new domain. It then redeploys the API with the new origin. If a deploy step fails, rerun `task deploy:dev` to converge from the state that OpenTofu already recorded.

The task writes `infra/generated/bindings.dev.jsonc`, compares it with OpenTofu outputs, and runs `tofu plan -detailed-exitcode`. The deploy fails if the plan shows changes. Review and commit the binding file with the deployment change. Rerun the checks with:

```sh
task infra:bindings:check
task infra:plan
```

To run the smoke test again, use:

```sh
task smoke:dev
```

The smoke test uses a stable account and workspace for the hostname and Better Auth secret. It creates one issue on its first run. Later runs change that issue's state from a second authenticated WebSocket client. Rotating the auth secret creates a new fixture instead of reusing an invalid password.

## Roll back a Worker version

List recent versions for the Worker you need to roll back:

```sh
bun run wrangler deployments list --config apps/web/wrangler.generated.jsonc
```

Rollback to the last known-good version id:

```sh
bun run wrangler rollback VERSION_ID --config apps/web/wrangler.generated.jsonc --yes
```

Repeat the command with the API or hub config if that Worker also needs a rollback. Keep the API, hub, and web versions compatible. After a hostname change, do not roll the API back to a version with the old `BETTER_AUTH_URL`. Redeploy the previous API source with the current generated Wrangler config instead. A rollback does not remove Durable Object migrations or SQLite data. Keep hub schema changes additive so the previous Worker version can read them.

## Roll back infrastructure

Revert the infrastructure change, then run `task infra:plan` and `task infra:apply`. Do not run `tofu destroy`. The Neon module has `prevent_destroy` to protect workspace data.
