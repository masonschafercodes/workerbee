import { createAuth } from "@workerbee/auth"
import { createDb, listWorkspaceSequences } from "@workerbee/db"
import { createApp } from "./app"
import {
  DurableObjectHubRouter,
  QueueChangePublisher,
  type HubNamespace,
  type QueueBinding,
} from "./cloudflare-realtime"

export type Env = {
  HYPERDRIVE: { connectionString: string }
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  REALTIME_QUEUE: QueueBinding
  HUB: HubNamespace
}

type Cached = {
  key: string
  app: ReturnType<typeof createApp>
}

let cached: Cached | null = null

function appFor(env: Env): ReturnType<typeof createApp> {
  const key = `${env.BETTER_AUTH_URL}:${env.BETTER_AUTH_SECRET}:${env.HYPERDRIVE.connectionString}`

  if (cached?.key === key) {
    return cached.app
  }

  const { db } = createDb(env.HYPERDRIVE.connectionString)
  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  })

  cached = {
    key,
    app: createApp({
      auth,
      db,
      origin: env.BETTER_AUTH_URL,
      realtime: {
        secret: env.BETTER_AUTH_SECRET,
        publisher: new QueueChangePublisher(env.REALTIME_QUEUE),
        hub: new DurableObjectHubRouter(env.HUB),
      },
    }),
  }

  return cached.app
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    return appFor(env).fetch(request)
  },
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    const { db, pool } = createDb(env.HYPERDRIVE.connectionString)

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
