type LockablePool = {
  query: (sql: string) => Promise<unknown>
}

// Arbitrary but stable. Both suites truncate the same schema, so they take this
// session lock for their whole run.
const LOCK_ID = 917401

export async function lockDatabase(pool: LockablePool): Promise<void> {
  await pool.query(`SELECT pg_advisory_lock(${LOCK_ID})`)
}

export async function unlockDatabase(pool: LockablePool): Promise<void> {
  await pool.query(`SELECT pg_advisory_unlock(${LOCK_ID})`)
}
