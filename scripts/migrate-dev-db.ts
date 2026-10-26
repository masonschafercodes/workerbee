import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const output = Bun.spawnSync({
  cmd: ["tofu", "-chdir=infra/envs/dev", "output", "-raw", "database_url"],
  cwd: root,
  stdout: "pipe",
  stderr: "ignore",
})

if (output.exitCode !== 0) {
  throw new Error("Could not read database_url from OpenTofu state")
}

const databaseUrl = output.stdout.toString().trim()

if (databaseUrl === "") {
  throw new Error("OpenTofu returned an empty database_url")
}

const migration = Bun.spawn(
  ["bun", "run", "--cwd", "packages/db", "migrate"],
  {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
)

process.exitCode = await migration.exited
