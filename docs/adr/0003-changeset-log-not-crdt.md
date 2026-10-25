# Clients sync by replaying server-ordered changesets, not CRDTs

One write transaction is one changeset with one workspace-wide `seq`. The transaction writes the
domain rows and the changeset rows, then bumps the workspace counter. Clients bootstrap a snapshot
at a `seq`, then apply later changesets. Agents consume the same stream as NDJSON. Clients never
disagree about order because a single writer assigns it. Two actors editing the same field still
resolve last write wins.

Read scope is part of the log. Every change carries the team it belongs to, or null for a
workspace-level entity, and the schema forbids a null team on an issue, comment, or state. The
realtime ticket carries the actor's team scope, so the hub drops changes outside it per socket.
Bootstrap applies the same rule. A restricted actor cannot learn that a hidden team's issue exists,
not even from a live frame.

The log is a replication log, not the truth. Rows are pruned after seven days and the domain
tables are authoritative. This is not event sourcing, and no projection is rebuilt from events.

## Considered options

- **CRDTs.** No coordination, but metadata on every value, partial replication and per-row
  permissions get awkward, and ordering is not a single line clients can reason about. Linear's
  public architecture talks through the same trade-off and lands in the same place. Text is the
  exception and will use Yjs later if concurrent editing demands it.
- **Event sourcing.** Extra machinery for no gain here. The log would need to be permanent and
  replayable, which also makes pruning, retention, and privacy harder.
- **ElectricSQL or a per-query sync engine.** A separate Elixir service to run, and a sync model
  built around query shapes rather than workspace-wide order. Wrong fit for Cloudflare-only
  hosting.
- **Polling.** Cheapest to build and the most expensive to run for agents. It also cannot produce
  the live feel the UI needs.

## Consequences

- The counter row is a per-workspace serialization point. Fine below roughly 50 writes per second
  per workspace. If that is exceeded, shard the counter per team and merge by timestamp.
- A deep gap is ordinary, not an error: the client re-bootstraps. Bootstrap must stay cheap.
- Field-level patches mean every write path must diff before writing, or the log carries
  full-row payloads and wastes tokens for agents.
- Last write wins for text in v1. That is a deliberate limit, and moving descriptions to Yjs is a
  later, isolated change.
- Scoped fanout costs one comparison per change per connection. At self-hosted scale that is noise.
  If it ever matters, precompute one filtered frame per distinct team scope and reuse it.
