import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"
import { requireEnv, repoRoot } from "./env"

export const DATABASE_TARGETS = ["local", "test", "remote"] as const
export type DatabaseTarget = (typeof DATABASE_TARGETS)[number]

/**
 * Keywords that make a statement a write. The match is deliberately
 * conservative: a read query that happens to contain one of these words in a
 * literal is refused, and the operator passes --write. Refusing a safe read is
 * cheaper than running an accidental write against a shared database.
 */
const WRITE_KEYWORDS =
  /\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|comment|copy|vacuum|reindex|refresh|call|do|set|begin|commit|rollback)\b/i

const READ_ONLY_START = /^(select|with|values|table|show)\b/i

const SIDE_EFFECT_FUNCTIONS =
  /\b(pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|set_config|nextval|setval|lo_import|lo_export|dblink|pg_notify)\s*\(/i

const STATEMENT_TIMEOUT_MS = 15_000

export function assertSingleStatement(sql: string): void {
  const withoutTrailingSemicolons = sql.trim().replace(/;+$/, "")

  if (withoutTrailingSemicolons.includes(";")) {
    throw new Error("Run one statement at a time. Multiple statements are refused.")
  }
}

export function assertReadOnly(sql: string): void {
  assertSingleStatement(sql)

  if (
    !READ_ONLY_START.test(sql.trim()) ||
    WRITE_KEYWORDS.test(sql) ||
    SIDE_EFFECT_FUNCTIONS.test(sql)
  ) {
    throw new Error("This statement can write. Pass --write to allow a write.")
  }
}

async function remoteDatabaseUrl(): Promise<string> {
  const result = Bun.spawnSync({
    cmd: ["tofu", "-chdir=infra/envs/dev", "output", "-raw", "database_url"],
    cwd: repoRoot,
    // Bun snapshots the environment at startup, so pass the values loadEnv
    // added explicitly or Tofu cannot read the R2 state backend.
    env: { ...process.env },
    stdout: "pipe",
    stderr: "pipe",
  })

  if (result.exitCode !== 0) {
    throw new Error(
      `Could not read database_url from OpenTofu state:\n${result.stderr.toString().trim()}`,
    )
  }

  const url = result.stdout.toString().trim()

  if (url === "") {
    throw new Error("OpenTofu returned an empty database_url")
  }

  return url
}

/**
 * The keyword guard cannot catch every write path, such as SELECT INTO, so
 * reads also run inside a read-only transaction. Postgres refuses writes there.
 */
async function runReadOnly(client: Bun.SQL, sql: string) {
  await client.unsafe("begin transaction read only")

  try {
    const rows = await client.unsafe(sql)
    await client.unsafe("commit")

    return rows
  } catch (error) {
    await client.unsafe("rollback").catch(() => {})
    throw error
  }
}

async function connectionString(target: DatabaseTarget): Promise<string> {
  if (target === "local") {
    return requireEnv("DATABASE_URL")
  }

  if (target === "test") {
    return requireEnv("TEST_DATABASE_URL")
  }

  return remoteDatabaseUrl()
}

function printUsage(): void {
  process.stderr.write(
    [
      "Usage: ops db query <sql> [options]",
      "",
      "Options:",
      "  --database local|test|remote   Connection to use (default: local)",
      "  --remote                       Shorthand for --database remote",
      "  --file <path>                  Read the statement from a file",
      "  --write                        Allow a writing statement",
      "",
      "Reads print row JSON. Writes print the affected row count.",
    ].join("\n") + "\n",
  )
}

export async function runDbCommand(args: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      database: { type: "string" },
      remote: { type: "boolean", default: false },
      file: { type: "string" },
      write: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })

  if (values.help === true) {
    printUsage()
    return 0
  }

  const [subcommand, ...statement] = positionals

  if (subcommand !== "query") {
    throw new Error("Use `ops db query <sql>`. Run with --help for usage.")
  }

  const sql =
    values.file === undefined
      ? statement.join(" ").trim()
      : readFileSync(values.file, "utf8").trim()

  if (sql === "") {
    throw new Error("Pass a SQL statement or --file <path>. Run with --help for usage.")
  }

  const target = (values.remote === true ? "remote" : (values.database ?? "local")) as string

  if (!DATABASE_TARGETS.includes(target as DatabaseTarget)) {
    throw new Error(`Unknown database ${JSON.stringify(target)}. Use local, test, or remote.`)
  }

  if (values.write === true) {
    assertSingleStatement(sql)
  } else {
    assertReadOnly(sql)
  }

  const connection = await connectionString(target as DatabaseTarget)
  const client = new Bun.SQL(connection, { max: 1 })

  try {
    await client.unsafe(`set statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    const rows =
      values.write === true ? await client.unsafe(sql) : await runReadOnly(client, sql)

    if (values.write === true) {
      process.stdout.write(`rows affected: ${rows.count ?? 0}\n`)
    } else {
      process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
    }
  } finally {
    await client.close()
  }

  return 0
}
