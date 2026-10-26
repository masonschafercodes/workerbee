import { resolve } from "node:path"
import { normalizeHostname, normalizeHostnameFromState } from "./hostname"

const root = resolve(import.meta.dir, "..")
const action = process.argv[2]

if (action !== "plan" && action !== "apply" && action !== "check") {
  throw new Error("Usage: bun run scripts/tofu-dev.ts <plan|apply|check>")
}

function hostnameFromState(): string {
  const result = Bun.spawnSync({
    cmd: ["tofu", "-chdir=infra/envs/dev", "output", "-raw", "web_hostname"],
    cwd: root,
    stdout: "pipe",
    stderr: "ignore",
  })

  return result.exitCode === 0
    ? normalizeHostnameFromState(result.stdout.toString())
    : ""
}

const hostnameArgument = process.argv.indexOf("--hostname")
const explicitHostname = hostnameArgument >= 0 ? process.argv[hostnameArgument + 1] : undefined
const hostname =
  explicitHostname === undefined
    ? hostnameFromState()
    : explicitHostname === ""
      ? ""
      : normalizeHostname(explicitHostname)
const command = action === "check" ? "plan" : action
const args = ["tofu", "-chdir=infra/envs/dev", command, `-var=hostname=${hostname}`]

if (action === "check") {
  args.push("-detailed-exitcode", "-input=false")
}

const child = Bun.spawn(args, {
  cwd: root,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
})
const exitCode = await child.exited

if (action === "check" && exitCode === 2) {
  console.error("Dev infrastructure plan is not empty")
  process.exitCode = 1
} else {
  process.exitCode = exitCode
}
