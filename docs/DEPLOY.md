# Deploy the dev environment

Deploys run in GitHub Actions when a pull request merges to `main`. The deploy job waits for the check and infra jobs, then runs `scripts/deploy-dev.ts`. That script builds the web bundle, applies the dev infrastructure, migrates Neon, deploys the Workers, checks the committed bindings and the final plan, and finishes with the live-update smoke test and `ops probe`.

Do not deploy from a laptop as the normal path. The same script runs locally only when you set `ALLOW_LOCAL_DEPLOY=1` for a break-glass deploy. Local runs read `infra/envs/dev/deploy.env`; CI reads repository secrets.

Use a Workers Paid account. Password hashing and the API bundle exceed the Workers Free plan's 10 ms CPU budget, so sign-in fails intermittently with error 1102. The Paid plan also allows an explicit CPU limit.

Run `task setup` to create `.env.dev` and a Better Auth secret. Keep Cloudflare and Neon credentials out of `.env.dev`.

Set `WORKERBEE_HOSTNAME` to a bare hostname, such as `issues.example.com`, with no scheme, port, or path.

## Repository secrets

Add these in the repository settings under Actions secrets. The workflow maps each secret to the environment name in parentheses.

| Secret | Environment name | Notes |
| --- | --- | --- |
| `TF_VAR_ACCOUNT_ID` | `TF_VAR_account_id` | Cloudflare account id |
| `TF_VAR_CLOUDFLARE_API_TOKEN` | `TF_VAR_cloudflare_api_token` | Cloudflare API token |
| `TF_VAR_NEON_ORG_ID` | `TF_VAR_neon_org_id` | Neon organization id |
| `NEON_API_KEY` | `NEON_API_KEY` | Neon API key |
| `AWS_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` | R2 state bucket access key |
| `AWS_SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` | R2 state bucket secret |
| `WORKERBEE_HOSTNAME` | `WORKERBEE_HOSTNAME` | Dev hostname |
| `BETTER_AUTH_SECRET` | `BETTER_AUTH_SECRET` | Must equal the value in your local `.env.dev` |
| `POSTHOG_KEY` | `POSTHOG_KEY` | Optional project token |
| `POSTHOG_HOST` | `POSTHOG_HOST` | Optional PostHog host |
| `POSTHOG_API_KEY` | `POSTHOG_API_KEY` | Optional source map upload key |
| `POSTHOG_PROJECT_ID` | `POSTHOG_PROJECT_ID` | Optional source map project id |

The script generates `infra/envs/dev/backend.hcl` from the account id. You only need to change a secret when a credential or hostname changes.

## Deploy and smoke test

Merging to `main` starts the deploy job. The script auto-approves its two OpenTofu applies so it can run non-interactively. The standalone `task infra:apply` remains interactive.

If you change a hostname, the script keeps the old API origin until OpenTofu attaches the new domain, then redeploys the API with the new origin. If a deploy step fails, rerun the deploy job in Actions, or set `ALLOW_LOCAL_DEPLOY=1` and run `task deploy:dev` to converge from the state that OpenTofu already recorded.

The script writes `infra/generated/bindings.dev.jsonc`, compares it with OpenTofu outputs, and runs `tofu plan -detailed-exitcode`. The deploy fails if the plan shows changes. Review and commit the binding file with the deployment change. Rerun the checks with:

```sh
task infra:bindings:check
task infra:plan
```

To run the smoke test again against the deployed stack, use:

```sh
task smoke:dev
task ops -- probe
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
