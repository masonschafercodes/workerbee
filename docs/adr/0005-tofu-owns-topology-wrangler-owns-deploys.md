# OpenTofu owns topology, Wrangler owns deploys

Both OpenTofu and Wrangler can create Workers, bindings, routes, and queues. Letting both do it
produces drift that is invisible until a deploy breaks in production. Letting OpenTofu ship every
code change makes deploys slow and couples application releases to a state file.

So each mutable resource has exactly one owner. A binding in a worker config that references a
queue or a bucket is configuration, not ownership: it does not create or delete the resource.
OpenTofu creates account-level resources and returns their ids: R2 buckets, Queues, Hyperdrive
configs, DNS records, Access applications, and rate limit rules. It also owns the Neon project,
with its own API key from the environment. It writes the Cloudflare ids to
`infra/generated/bindings.<env>.jsonc`. A generator merges that file into the Wrangler configs.
CI validates OpenTofu without a backend and runs Wrangler dry-runs. Operators review a
state-backed plan with `task infra:plan` before apply. `task deploy:dev` applies the infrastructure
and runs a final `tofu plan -detailed-exitcode`, failing if the plan is not empty. This keeps
remote-state and provider credentials out of CI.

Durable Object namespaces break the pattern, for a mechanical reason. A DO class exists only after
a worker migration creates it, and the migration travels with the script. Wrangler therefore owns
the hub script and its migrations. The API worker binds the class by name with `script_name`, so
tofu never holds a namespace id.

Application secrets stay out of state. API keys, webhook secrets, and session keys are written with
`wrangler secret bulk` from the deploy environment or a password manager. Database credentials are the exception. The
Neon project computes a role password, and Hyperdrive takes that password inline, so it lands in
state. The Neon API key itself never does, because the provider reads `NEON_API_KEY` from the
environment. Treat the state bucket as sensitive: encrypt it and scope the token that can read it.

## Consequences

- Two tools, one generated file, and a committed artifact that must stay in sync with the real
  account. Reviewers see binding changes in diffs.
- Renaming a resource crosses both tools. Do not rename casually, and never rename a queue or
  Hyperdrive config in place.
- State lives in R2 with `use_lockfile = true` (native conditional-write locking), so there is no
  DynamoDB-style lock table to operate.
- A fresh environment needs one bootstrap apply with a human. CI validates code and configuration, and the operator runs state-backed plans and deployments.
