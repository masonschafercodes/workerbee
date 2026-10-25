# Postgres is the system of record, and it runs outside Cloudflare

Cloudflare gives Workers compute, Queues, R2, and Durable Objects, but no durable block storage
for a database. Durable Object SQLite is a poor system of record for this app: 10 GB per object,
one single-threaded object, no ad-hoc SQL, no joins across workspaces, and no ordinary backup and
restore path. So the write model lives in Postgres, reached from Workers through Hyperdrive, and
Durable Objects do one job only: fan changesets out to connected clients.

The v1 database is a Neon project, created by OpenTofu with the Neon provider. Operating a
database is not the interesting part of this project, and a managed instance buys automated
backups, patching, and failover for the price of a small monthly bill. The project resource
exposes the host, database, user, and password directly, so Hyperdrive is wired from module
outputs and no connection string is split by hand. `prevent_destroy` keeps an environment
teardown from deleting data.

A self-hosted VM with WAL archiving to R2 stays possible, but it costs a module change, Workers
VPC wiring, and a new connection string, not a one-line swap.

Realtime is not on the write path: a request commits to Postgres and enqueues its `seq`. If the
hub or the queue is unhealthy, writes still succeed and clients catch up through `/sync?since=`.

## Considered options

- **Durable Object SQLite per workspace.** Lowest latency and no database to operate, but the
  10 GB ceiling, no cross-workspace queries for operations, weak backup story, and hard vendor
  lock make it the wrong choice for the primary store.
- **Postgres with no Hyperdrive.** Works, but pays TLS, auth, and handshake round trips on every
  request from an edge isolate. Hyperdrive exists for this.
- **D1.** Familiar on Cloudflare, but SQLite limits and no `pg` ecosystem. Postgres wins on
  honesty about what we will need later.

## Consequences

- Latency to the database sets the floor for write latency. Keep Postgres in one region near the
  users and keep queries per request small.
- The provider runs Postgres. We still own the schema, the migrations, and proof that a restore
  works, which is a Phase 4 drill against a scratch database.
- Hyperdrive pools connections, so session-level `SET` is unsafe. Tenant context must be
  transaction-local (`SET LOCAL`).
- The Durable Object layer stays stateless beyond a bounded changeset buffer, so it can be
  rebuilt or replaced without a data migration.
