import { createAuth } from "@workerbee/auth"
import { createDb, listWorkspaceSequences, type Db } from "@workerbee/db"
import { createApp } from "./app"
import {
  DurableObjectHubRouter,
  QueueChangePublisher,
} from "./cloudflare-realtime"

export type Env = ApiEnv & {
  readonly BETTER_AUTH_SECRET: string
}

function dependencies(env: Env): { app: ReturnType<typeof createApp>; db: Db } {
  const db = createDb(env.HYPERDRIVE.connectionString, 1)
  const auth = createAuth({
    db: db.db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  })

  const app = createApp({
    auth,
    db: db.db,
    origin: env.BETTER_AUTH_URL,
    realtime: {
      secret: env.BETTER_AUTH_SECRET,
      publisher: new QueueChangePublisher(env.REALTIME_QUEUE),
      hub: new DurableObjectHubRouter(env.HUB),
    },
  })

  return { app, db }
}

async function closeQuietly(db: Db): Promise<void> {
  try {
    await db.pool.end()
  } catch {
    // A request that already produced a response wins. Hyperdrive also reaps
    // the connection when the isolate discards it.
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Hyperdrive pools connections itself, and Workers cannot keep a socket
    // between requests. A cached pg Pool inside the isolate therefore hands
    // out dead connections, which the runtime cancels as a hung request.
    const { app, db } = dependencies(env)

    try {
      return await app.fetch(request)
    } finally {
      await closeQuietly(db)
    }
  },
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    const { db, pool } = createDb(env.HYPERDRIVE.connectionString, 1)

    try {
      const sequences = await listWorkspaceSequences(db)

      await Promise.all(
        sequences.map(async (notification) => {
          try {
            await env.REALTIME_QUEUE.send(notification)
          } catch {
            // The next sweep retries every latest workspace cursor.
          }
        }),
      )
    } finally {
      await pool.end()
    }
  },
}
