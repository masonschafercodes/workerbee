import { unlink } from "node:fs/promises"
import { resolve } from "node:path"
import { Glob } from "bun"
import { loadEnv, optionalEnv, repoRoot, requireEnv } from "./ops/env"

const WEB_CONFIG = "apps/web/wrangler.generated.jsonc"
const API_CONFIG = "apps/api/wrangler.generated.jsonc"
const HUB_CONFIG = "apps/hub/wrangler.generated.jsonc"

const REQUIRED_ENV = [
  "TF_VAR_account_id",
  "TF_VAR_cloudflare_api_token",
  "TF_VAR_neon_org_id",
  "NEON_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "WORKERBEE_HOSTNAME",
  "BETTER_AUTH_SECRET",
] as const

function run(args: string[], extraEnv: Record<string, string | undefined> = {}): void {
  process.stdout.write(`\n== ${args.join(" ")}\n`)

  const child = Bun.spawnSync({
    cmd: args,
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })

  if (child.exitCode !== 0) {
    throw new Error(`Deploy step failed with exit ${child.exitCode}: ${args.join(" ")}`)
  }
}

function output(args: string[]): string {
  const child = Bun.spawnSync({
    cmd: args,
    cwd: repoRoot,
    env: { ...process.env },
    stdout: "pipe",
    stderr: "inherit",
  })

  if (child.exitCode !== 0) {
    throw new Error(`Command failed with exit ${child.exitCode}: ${args.join(" ")}`)
  }

  return child.stdout.toString().trim()
}

async function removeSourceMaps(): Promise<void> {
  const dist = resolve(repoRoot, "apps/web/dist")

  for await (const file of new Glob("**/*.map").scan({ cwd: dist })) {
    await unlink(resolve(dist, file))
  }
}

export function assertDeployAllowed(env: Record<string, string | undefined> = process.env): void {
  const ci = env.CI?.toLowerCase()
  const isCi = ci === "true" || ci === "1"

  if (!isCi && env.ALLOW_LOCAL_DEPLOY !== "1") {
    throw new Error(
      "Deploys run in CI on merge to main. Set ALLOW_LOCAL_DEPLOY=1 only for a break-glass deploy.",
    )
  }
}

export async function deploy(): Promise<void> {
  assertDeployAllowed()
  loadEnv()

  for (const name of REQUIRED_ENV) {
    requireEnv(name)
  }

  if (optionalEnv("CLOUDFLARE_ACCOUNT_ID") === undefined) {
    process.env.CLOUDFLARE_ACCOUNT_ID = requireEnv("TF_VAR_account_id")
  }

  if (optionalEnv("CLOUDFLARE_API_TOKEN") === undefined) {
    process.env.CLOUDFLARE_API_TOKEN = requireEnv("TF_VAR_cloudflare_api_token")
  }

  process.stdout.write("\n== build web bundle\n")
  run(["bun", "run", "--cwd", "apps/web", "build"], {
    VITE_POSTHOG_KEY: optionalEnv("POSTHOG_KEY") ?? "",
    VITE_POSTHOG_HOST: optionalEnv("POSTHOG_HOST") ?? "https://us.i.posthog.com",
  })
  await removeSourceMaps()

  run(["bun", "run", "scripts/write-dev-backend.ts"])
  run(["tofu", "-chdir=infra/envs/dev", "init", "-input=false", "-backend-config=backend.hcl"])

  const currentHostname = output(["bun", "run", "scripts/tofu-dev.ts", "hostname"])
  const requestedHostname = output([
    "bun",
    "run",
    "scripts/normalize-hostname.ts",
    requireEnv("WORKERBEE_HOSTNAME"),
  ])
  const configHostname = currentHostname === "" ? requestedHostname : currentHostname

  run(["bun", "run", "scripts/tofu-dev.ts", "apply", "--hostname", currentHostname, "--auto-approve"])
  run([
    "bun",
    "run",
    "scripts/generate-wrangler-configs.ts",
    "--from-tofu",
    "--hostname",
    configHostname,
  ])
  run(["bun", "run", "scripts/migrate-dev-db.ts"])

  run(["bun", "run", "--bun", "wrangler", "deploy", "--config", HUB_CONFIG])
  run(["bun", "run", "scripts/set-worker-secret.ts", HUB_CONFIG])
  run(["bun", "run", "--bun", "wrangler", "deploy", "--config", API_CONFIG])
  run(["bun", "run", "scripts/set-worker-secret.ts", API_CONFIG])
  run(["bun", "run", "--bun", "wrangler", "deploy", "--config", WEB_CONFIG])

  run(["bun", "run", "scripts/tofu-dev.ts", "apply", "--hostname", requestedHostname, "--auto-approve"])
  run(["bun", "run", "scripts/generate-wrangler-configs.ts", "--from-tofu"])

  if (configHostname !== requestedHostname) {
    run(["bun", "run", "--bun", "wrangler", "deploy", "--config", API_CONFIG])
    run(["bun", "run", "scripts/set-worker-secret.ts", API_CONFIG])
  }

  run(["bun", "run", "scripts/generate-wrangler-configs.ts", "--check-tofu"])
  run(["bun", "run", "scripts/tofu-dev.ts", "check", "--hostname", requestedHostname])

  const url = `https://${requestedHostname}`
  run(["bun", "run", "scripts/smoke-dev.ts"], { WORKERBEE_URL: url })
  run(["bun", "run", "scripts/ops.ts", "probe"], { WORKERBEE_URL: url })

  process.stdout.write("\n== deploy complete\n")
}

if (import.meta.main) {
  try {
    await deploy()
  } catch (error) {
    process.stderr.write(
      `\nDeploy failed: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  }
}
