# Agent tools are task-shaped, batched, and budgeted in CI

Agent cost is dominated by round trips and context bloat, not by payload bytes. So the agent
surface is not a REST mirror. It is a small set of task-shaped tools (12 in v1) that answer whole
questions: `work.queue`, `context.bundle`, `changes.pull`, batched `issues.update`, and an event
subscription instead of polling.

Every tool is defined once in `packages/agent-tools`: input schema, permission check, handler,
and renderer. MCP and plain HTTP are thin adapters over one dispatcher, so idempotency, budgets,
scopes, and telemetry cannot drift between transports.

Cost discipline is a test, not an intention. Each renderer has a fixture and an asserted token
ceiling in CI. `work.queue` with 10 issues must stay under 1200 tokens. A change that doubles a
response fails the build, and the author must argue for the new budget.

## Considered options

- **Expose REST endpoints 1:1 as tools.** Cheap to build, expensive to use. A triage task becomes
  40 calls and the model pays for 40 tool schemas plus 40 results.
- **GraphQL.** Flexible for humans, bad for models: introspection and schema bloat in context,
  and per-field authorization is harder to get right than per-tool.
- **One SQL or generic query tool.** Maximum flexibility, no safety, no stable schema, and a
  prompt-injection path straight into the database.
- **Letting agents read the workspace snapshot every run.** Simple, and the single largest token
  sink. Deltas with `since` cursors exist to prevent it.

## Consequences

- Adding a field to a tool is a budget decision, not just a schema change. That friction is the
  point.
- Task-shaped tools encode product opinion. When the opinion changes, the tool changes, not the
  caller.
- Per-agent and per-workspace budgets plus `tool_call` telemetry must exist before agents get
  unattended write access. A runaway loop should hit a wall, not an invoice.
- Idempotency keys are mandatory on mutations, because retries are normal for agents and duplicate
  comments are both noisy and expensive.
