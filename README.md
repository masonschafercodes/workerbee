# Workerbee

A self-hosted issue tracker in the shape of Linear, for one operator and their agents. It is an
internal tool, not a SaaS product.

- [Plan](docs/PLAN.md): scope, architecture, phases, risks.
- [Decisions](docs/adr/): the choices that are expensive to reverse.
- [Glossary](docs/GLOSSARY.md): the words the codebase uses.
- [Setup](docs/SETUP.md): what to configure before the dev environment can be applied.

## Status

Phase 0 in progress. Landed so far: the Bun workspace, domain ids and policy, the changeset sync
primitives, the API shell, the OpenTofu `dev` environment with its Neon project, the Drizzle schema
with Better Auth tables, and working sign-up, sign-in, and workspace creation proven by an end to
end test. No worker deploy, sync endpoints, or UI yet.

```sh
bun install
bun run check
tofu -chdir=infra/envs/dev init -backend=false
tofu -chdir=infra/envs/dev validate
```
