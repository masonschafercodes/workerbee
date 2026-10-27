import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export const repoRoot = resolve(import.meta.dir, "..", "..")

/** Files every ops command reads. Process environment values win so CI overrides work. */
export const ENV_FILES = [".env.dev", "infra/envs/dev/deploy.env"] as const

/** Malformed lines are skipped so one bad line cannot break every command. */
export function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (line === "" || line.startsWith("#")) {
      continue
    }

    const assignment = line.startsWith("export ") ? line.slice("export ".length) : line
    const separator = assignment.indexOf("=")

    if (separator <= 0) {
      continue
    }

    const key = assignment.slice(0, separator).trim()
    const value = assignment.slice(separator + 1).trim()

    if (key === "") {
      continue
    }

    values[key] = unquote(stripComment(value))
  }

  return values
}

function stripComment(value: string): string {
  let quote: string | undefined

  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index)

    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined
      }

      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    const previous = value.charAt(index - 1)

    if (character === "#" && (index === 0 || previous === " " || previous === "\t")) {
      return value.slice(0, index).trim()
    }
  }

  return value.trim()
}

function unquote(value: string): string {
  const first = value.charAt(0)
  const last = value.charAt(value.length - 1)

  if (value.length >= 2 && (first === '"' || first === "'") && last === first) {
    return value.slice(1, -1)
  }

  return value
}

export function loadEnv(files: readonly string[] = ENV_FILES): void {
  for (const file of files) {
    const path = resolve(repoRoot, file)

    if (!existsSync(path)) {
      continue
    }

    for (const [key, value] of Object.entries(parseEnvFile(readFileSync(path, "utf8")))) {
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]

  return value === undefined || value === "" ? undefined : value
}

export function requireEnv(name: string): string {
  const value = optionalEnv(name)

  if (value === undefined) {
    throw new Error(`Missing ${name}. Set it in .env.dev or the process environment.`)
  }

  return value
}

/** Deployed dev is the default target for operational probes. */
export function defaultBaseUrl(): string {
  const explicit = optionalEnv("WORKERBEE_URL")

  if (explicit !== undefined) {
    return new URL(explicit).origin
  }

  const hostname = optionalEnv("WORKERBEE_HOSTNAME")

  if (hostname !== undefined) {
    return new URL(hostname.includes("://") ? hostname : `https://${hostname}`).origin
  }

  throw new Error(
    "Set WORKERBEE_URL or WORKERBEE_HOSTNAME in infra/envs/dev/deploy.env, or pass --url.",
  )
}
