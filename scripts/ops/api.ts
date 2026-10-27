import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"
import { z } from "zod"
import { defaultBaseUrl, requireEnv } from "./env"

const workspaceSchema = z.object({ id: z.string(), slug: z.string() })
const workspaceListSchema = z.object({ workspaces: z.array(workspaceSchema) })

type Session = {
  readonly cookie: string
  readonly workspace: string
}

type RequestOptions = {
  readonly method?: string
  readonly body?: unknown
  readonly cookie?: string
  readonly workspace?: string
  readonly headers?: Headers
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))

  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

export function resolveRequestUrl(baseUrl: string, path: string): URL {
  const url = new URL(path, baseUrl)

  // The session cookie must never follow a path that resolves off-origin.
  if (url.origin !== new URL(baseUrl).origin) {
    throw new Error(`Refusing cross-origin request to ${url.origin}`)
  }

  return url
}

async function request(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const url = resolveRequestUrl(baseUrl, path)
  const headers = new Headers(options.headers ?? {})
  headers.set("origin", baseUrl)

  if (options.body !== undefined) {
    headers.set("content-type", "application/json")
  }

  if (options.cookie !== undefined) {
    headers.set("cookie", options.cookie)
  }

  if (options.workspace !== undefined) {
    headers.set("x-workerbee-workspace", options.workspace)
  }

  return fetch(url, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
}

/**
 * Sign in as a deterministic ops actor and resolve one workspace. Credentials
 * derive from the auth secret and the base URL, so the same deployment always
 * maps to the same account without storing another secret.
 */
async function authenticate(baseUrl: string, requestedWorkspace?: string): Promise<Session> {
  const secret = requireEnv("BETTER_AUTH_SECRET")
  const baseFingerprint = (await digest(baseUrl)).slice(0, 8)
  const secretFingerprint = (await digest(secret)).slice(0, 8)
  const email = `workerbee-ops+${baseFingerprint}-${secretFingerprint}@example.com`
  const password = await digest(`${secret}:${baseUrl}:ops`)

  let signIn = await request(baseUrl, "/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password },
  })

  if (!signIn.ok) {
    const signUp = await request(baseUrl, "/api/auth/sign-up/email", {
      method: "POST",
      body: { name: "Workerbee ops", email, password },
    })

    if (!signUp.ok) {
      throw new Error(`Ops account sign-up failed with HTTP ${signUp.status}`)
    }

    signIn = await request(baseUrl, "/api/auth/sign-in/email", {
      method: "POST",
      body: { email, password },
    })
  }

  const cookie = cookieHeader(signIn)

  if (!signIn.ok || cookie === "") {
    throw new Error(`Ops account sign-in failed with HTTP ${signIn.status}`)
  }

  const listResponse = await request(baseUrl, "/api/v1/workspaces", { cookie })
  const listBody: unknown = await listResponse.json()
  const { workspaces } = workspaceListSchema.parse(listBody)

  if (!listResponse.ok) {
    throw new Error(`Ops workspace lookup failed with HTTP ${listResponse.status}`)
  }

  const existing = workspaces.find((workspace) => workspace.slug === requestedWorkspace)

  if (existing !== undefined) {
    return { cookie, workspace: existing.slug }
  }

  if (requestedWorkspace !== undefined) {
    throw new Error(`Ops account is not a member of workspace ${JSON.stringify(requestedWorkspace)}`)
  }

  const first = workspaces[0]

  if (first !== undefined) {
    return { cookie, workspace: first.slug }
  }

  const slug = `ops-${baseFingerprint}-${secretFingerprint}`
  const created = await request(baseUrl, "/api/v1/workspaces", {
    method: "POST",
    cookie,
    body: { name: "Workerbee ops", slug },
  })

  if (!created.ok) {
    throw new Error(`Ops workspace creation failed with HTTP ${created.status}`)
  }

  return { cookie, workspace: slug }
}

function printUsage(): void {
  process.stderr.write(
    [
      "Usage: ops api [METHOD] <path> [options]",
      "",
      "Calls the API with a real signed-in session. GET is the default method.",
      "",
      "Options:",
      "  --url <origin>        Target origin (default: deployed dev)",
      "  --workspace <slug>    Workspace header (default: first membership)",
      "  --body <json|@file>   JSON body",
      "  --header <k:v>        Extra header, repeatable",
      "  --expect <statuses>   Comma-separated accepted statuses (default: any 2xx)",
      "  --anonymous           Skip sign-in; no cookie or workspace header",
      "",
      "Exits 1 when the response status is not expected.",
    ].join("\n") + "\n",
  )
}

const METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"])

function parseHeaders(values: readonly string[]): Headers {
  const headers = new Headers()

  for (const header of values) {
    const separator = header.indexOf(":")

    if (separator <= 0) {
      throw new Error(`Header ${JSON.stringify(header)} must be name:value`)
    }

    headers.set(header.slice(0, separator).trim(), header.slice(separator + 1).trim())
  }

  return headers
}

function readBody(value: string): unknown {
  const source = value.startsWith("@") ? readFileSync(value.slice(1), "utf8") : value

  try {
    return JSON.parse(source)
  } catch {
    throw new Error("--body must be valid JSON, or @path to a JSON file")
  }
}

function expectedStatuses(value: string | undefined): readonly number[] {
  if (value === undefined) {
    return []
  }

  return value.split(",").map((part) => {
    const status = Number(part.trim())

    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new Error(`Invalid expected status ${JSON.stringify(part)}`)
    }

    return status
  })
}

export async function runApiCommand(args: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      url: { type: "string" },
      workspace: { type: "string" },
      body: { type: "string" },
      header: { type: "string", multiple: true },
      expect: { type: "string" },
      anonymous: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })

  if (values.help === true) {
    printUsage()
    return 0
  }

  const [first, second] = positionals
  const leadingMethod = first?.toUpperCase()

  if (first === undefined) {
    throw new Error("Pass a request path. Run with --help for usage.")
  }

  const method = leadingMethod !== undefined && METHODS.has(leadingMethod) ? leadingMethod : "GET"
  const path = leadingMethod !== undefined && METHODS.has(leadingMethod) ? second : first

  if (path === undefined) {
    throw new Error("Pass a request path. Run with --help for usage.")
  }

  const baseUrl = values.url === undefined ? defaultBaseUrl() : new URL(values.url).origin
  const headers = parseHeaders(values.header ?? [])
  const body = values.body === undefined ? undefined : readBody(values.body)

  const session =
    values.anonymous === true ? undefined : await authenticate(baseUrl, values.workspace)

  const response = await request(baseUrl, path, {
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
    ...(session !== undefined ? { cookie: session.cookie, workspace: session.workspace } : {}),
  })

  const text = await response.text()
  const contentType = response.headers.get("content-type") ?? "-"

  process.stdout.write(`${method} ${path} -> ${response.status} ${contentType}\n`)

  if (text !== "") {
    try {
      process.stdout.write(`${JSON.stringify(JSON.parse(text), null, 2)}\n`)
    } catch {
      process.stdout.write(`${text}\n`)
    }
  }

  const expected = expectedStatuses(values.expect)
  const accepted =
    expected.length === 0
      ? response.status >= 200 && response.status < 300
      : expected.includes(response.status)

  if (!accepted) {
    process.stderr.write(
      `Unexpected status ${response.status}. Expected ${expected.length === 0 ? "2xx" : expected.join(", ")}.\n`,
    )
    return 1
  }

  return 0
}
