# Live updates design

## Publisher

Each domain transaction writes its changeset and workspace sequence, then commits. After commit, the API calls the `ChangePublisher` port with `{ workspaceId, seq }`. A queue outage cannot fail a write. The queue carries only a wake-up cursor, not domain data. Its consumer wakes the workspace hub, which reads ordered changesets from Postgres. Duplicate or out-of-order delivery converges. A scheduled sweeper republishes the latest sequence for every workspace.

## Ticket

`POST /api/v1/realtime-ticket` uses the authenticated tenant and principal. It never accepts actor or workspace ids from the request body. The API signs a short-lived ticket with the existing Better Auth secret. The ticket contains the workspace id, actor id, allowed team ids, and expiry. The API checks the ticket before it routes a socket request. The hub verifies it again before accepting the socket and checks that the ticket's workspace matches the workspace assigned to the hub.

## Hub and replay

One Durable Object owns each workspace's sockets and a bounded, ordered buffer in DO SQLite. Queue messages prompt the object to read committed changesets from Postgres. It stores and broadcasts only new sequences. The hub filters every changeset by the team scope in each ticket. A client sends `since` when it connects. The hub sends no frame for a changeset outside the ticket's scope. The next visible sequence gap makes the browser catch up through `/sync`; if the gap remains, the browser bootstraps. Neither the live stream nor `/sync` returns hidden changeset metadata. The hub replays contiguous retained changesets or sends `reset` when the cursor is too old or the retained range is not contiguous. If Postgres's sequence regresses after a restore, the hub rebuilds its buffer and keeps a reset-required flag in SQLite. New connections bootstrap because workspace sequences have no generation id to distinguish restored data from an older cache. Postgres remains authoritative, and the hub never handles writes.

## Local development

Keep `task dev` on the existing Bun API and Vite loop. The API process runs a small in-memory hub adapter for local sockets. The adapter and Durable Object use the same ticket validation, replay, filtering, and frame code. Production uses Wrangler's Durable Object and Queues. Only transport and storage differ. The sync protocol stays the same.
