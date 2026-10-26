import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const config = process.argv[2]
const secret = process.env.BETTER_AUTH_SECRET
const allowedConfigs = new Set([
  "apps/api/wrangler.generated.jsonc",
  "apps/hub/wrangler.generated.jsonc",
])

if (config === undefined || !allowedConfigs.has(config)) {
  throw new Error("Pass the generated API or hub Wrangler config")
}

if (secret === undefined || secret === "") {
  throw new Error("BETTER_AUTH_SECRET is required")
}

const command = Bun.spawn(
  ["bun", "run", "--bun", "wrangler", "secret", "bulk", "--config", config],
  {
    cwd: root,
    stdin: "pipe",
    stdout: "inherit",
    stderr: "inherit",
  },
)

const secrets: Record<string, string> = { BETTER_AUTH_SECRET: secret }

for (const name of ["POSTHOG_KEY", "POSTHOG_HOST"] as const) {
  const value = process.env[name]

  if (value !== undefined && value !== "") {
    secrets[name] = value
  }
}

command.stdin.write(JSON.stringify(secrets))
command.stdin.end()
process.exitCode = await command.exited
