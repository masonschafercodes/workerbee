import { createAuth } from "@workerbee/auth"
import { createDb } from "@workerbee/db"
import { createApp } from "./app"

function requireEnv(name: string): string {
  const value = Bun.env[name]

  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable ${name}`)
  }

  return value
}

const port = Number(Bun.env.PORT ?? 3001)
const secret = requireEnv("BETTER_AUTH_SECRET")
const baseURL = Bun.env.BETTER_AUTH_URL ?? `http://localhost:${port}`

const { db } = createDb(requireEnv("DATABASE_URL"))
const auth = createAuth({ db, secret, baseURL })
const app = createApp({ auth, db, origin: baseURL })

Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`workerbee api listening on http://localhost:${port}`)
