import { Client } from "pg"

const databaseUrl = Bun.env.DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("DATABASE_URL is required")
}

const testDatabase = Bun.env.POSTGRES_TEST_DB ?? "workerbee_test"

if (!/^[a-z0-9_]+$/.test(testDatabase)) {
  throw new Error(`Invalid test database name: ${testDatabase}`)
}

const url = new URL(databaseUrl)
url.pathname = "/postgres"

const client = new Client({ connectionString: url.toString() })

await client.connect()

try {
  const existing = await client.query("select 1 from pg_database where datname = $1", [
    testDatabase,
  ])

  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${testDatabase}"`)
    console.log(`created ${testDatabase}`)
  }
} finally {
  await client.end()
}
