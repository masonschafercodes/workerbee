import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

export type Database = NodePgDatabase<typeof schema>

export type Db = {
  readonly db: Database
  readonly pool: Pool
}

/**
 * The only place a Postgres connection is created. Production passes the
 * Hyperdrive connection string, local development passes a localhost URL, and
 * tests pass a scratch database.
 */
export function createDb(connectionString: string, maxConnections = 10): Db {
  const pool = new Pool({ connectionString, max: maxConnections })

  return { db: drizzle(pool, { schema }), pool }
}

export { schema }
