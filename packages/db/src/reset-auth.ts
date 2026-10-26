import { Client } from "pg"

const databaseUrl = Bun.env.DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("DATABASE_URL is required")
}

const client = new Client({ connectionString: databaseUrl })

await client.connect()

try {
  const jwks = await client.query("DELETE FROM jwks")
  const sessions = await client.query("DELETE FROM session")

  console.log(
    `cleared ${jwks.rowCount ?? 0} JWKS keys and ${sessions.rowCount ?? 0} sessions`,
  )
} finally {
  await client.end()
}
