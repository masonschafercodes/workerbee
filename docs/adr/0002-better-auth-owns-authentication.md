# Better Auth owns authentication, our policy module owns authorization

Authentication is Better Auth 1.7 (MIT, TypeScript, runs on Workers). Better Auth can provide
sessions, password hashing, passkeys, 2FA, API keys, and an OAuth 2.1 authorization server for MCP
clients. The v1 config enables only email and password, `organization` (our workspace), `apiKey`
for agents and CI, and `jwt` as the signing layer. Passkeys, 2FA, and `mcp` are plugins we have not
turned on yet.

Authorization is ours. Team scope, private teams, issue visibility, and agent scopes are product
semantics, not auth plumbing. They live in `packages/domain/policy` as pure functions over
`(actor, workspace, team, issue, action)`. Better Auth org roles are coarse (`owner`, `admin`,
`member`) and cannot express "this agent may comment on `ENG` but not move `OPS` issues".

Humans and agents share one `actor` id space. A `user` row and an `agent` row each project into
`actor`, so assignment, comments, and history reference one column instead of a polymorphic key.

## Considered options

- **Zitadel.** Strong multi-tenancy, native machine-to-machine tokens, OIDC and SAML. Rejected for
  now: AGPL, a second Go service plus Postgres to operate, and awkward local development next to
  Workers. Revisit if external SSO or machine identity becomes a real requirement.
- **Keycloak or Authentik.** Same shape as Zitadel with heavier operations. Rejected.
- **Hand-rolled sessions.** Rejected outright. The brief says not to write auth.
- **Using Better Auth org roles as the whole permission model.** Rejected because workspace-level
  roles cannot express team and issue scope, and agents need narrower scopes than any human role.

## Consequences

- Better Auth tables live in our database. We run its migrations in our pipeline and pin the
  version. Upgrading is a reviewed change, not a floating dependency.
- Migrating to an external IdP later means exporting users and re-issuing credentials. This is
  the cost of not running a second service today.
- The word "organization" appears in Better Auth APIs and "workspace" everywhere else. The auth
  package is the only place that calls Better Auth, and the database schema aliases the table as
  `workspace`.
- Workspace creation goes through `POST /api/v1/workspaces`, which validates the slug with the
  domain rule and then calls Better Auth. Better Auth's own organization hook is not invoked on its
  plugin create path, so domain validation cannot live there.
