import { createAuth } from "@workerbee/auth"
import { createDb } from "@workerbee/db"
import { createApp } from "./app"

export type Env = {
  HYPERDRIVE: { connectionString: string }
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
}

type Cached = {
  key: string
  app: ReturnType<typeof createApp>
}

let cached: Cached | null = null

function appFor(env: Env): ReturnType<typeof createApp> {
  const key = `${env.BETTER_AUTH_URL}:${env.BETTER_AUTH_SECRET}`

  if (cached?.key === key) {
    return cached.app
  }

  const { db } = createDb(env.HYPERDRIVE.connectionString)
  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  })

  cached = { key, app: createApp({ auth, origin: env.BETTER_AUTH_URL }) }

  return cached.app
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    return appFor(env).fetch(request)
  },
}
