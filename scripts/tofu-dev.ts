import { resolve } from "node:path"
import { z } from "zod"
import { normalizeHostname, normalizeHostnameFromState } from "./hostname"

const root = resolve(import.meta.dir, "..")
const action = process.argv[2]

function hostnameFromState(): string {
  const result = Bun.spawnSync({
    cmd: ["tofu", "-chdir=infra/envs/dev", "output", "-json", "web_hostname"],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })

  if (result.exitCode !== 0) {
    const diagnostic = `${result.stdout.toString()}\n${result.stderr.toString()}`

    if (/No state file (?:was )?found|Output "web_hostname" not found|No outputs found/i.test(diagnostic)) {
      return ""
    }

    const detail = result.stderr.toString().trim() || result.stdout.toString().trim()

    if (detail !== "") {
      process.stderr.write(`${detail}\n`)
    }

    throw new Error("Could not read web_hostname from OpenTofu state. Check backend access.")
  }

  let output: unknown

  try {
    output = JSON.parse(result.stdout.toString())
  } catch (error) {
    throw new Error("OpenTofu output web_hostname was not valid JSON", { cause: error })
  }

  const parsed = z.string().safeParse(output)

  if (!parsed.success) {
    throw new Error("OpenTofu output web_hostname must be a string")
  }

  try {
    return normalizeHostnameFromState(parsed.data)
  } catch (error) {
    throw new Error("OpenTofu output web_hostname is not a valid DNS hostname", { cause: error })
  }
}

if (action === "hostname") {
  console.log(hostnameFromState())
  process.exit(0)
}

if (action !== "plan" && action !== "apply" && action !== "check") {
  throw new Error("Usage: bun run scripts/tofu-dev.ts <plan|apply|check|hostname>")
}

const hostnameArgument = process.argv.indexOf("--hostname")
const autoApprove = process.argv.includes("--auto-approve")

if (autoApprove && action !== "apply") {
  throw new Error("--auto-approve is only valid with apply")
}

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

if (autoApprove) {
  args.push("-auto-approve")
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
