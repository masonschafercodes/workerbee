import { runApiCommand } from "./ops/api"
import { runDbCommand } from "./ops/db"
import { loadEnv } from "./ops/env"
import { runProbeCommand } from "./ops/probe"

const USAGE = [
  "Usage: ops <command> [options]",
  "",
  "Commands:",
  "  db query <sql>      Run one SQL statement against local, test, or remote",
  "  api [METHOD] <path> Call the API with a real signed-in session",
  "  probe               Check the deployed stack end to end",
  "",
  "Every command reads .env.dev and infra/envs/dev/deploy.env itself. Run a",
  "command with --help for its options. Use `task ops -- <command>` from the",
  "repository root.",
  "",
  "Examples:",
  "  task ops -- db query \"select count(*) from issue\"",
  "  task ops -- api GET /api/v1/protocol",
  "  task ops -- probe --json",
].join("\n")

const commands: Record<string, (args: readonly string[]) => Promise<number>> = {
  db: runDbCommand,
  api: runApiCommand,
  probe: runProbeCommand,
}

async function main(argv: readonly string[]): Promise<number> {
  const [name, ...rest] = argv

  if (name === undefined || name === "--help" || name === "-h" || name === "help") {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }

  const command = commands[name]

  if (command === undefined) {
    process.stderr.write(`Unknown command ${JSON.stringify(name)}.\n\n${USAGE}\n`)
    return 1
  }

  loadEnv()

  return command(rest)
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
