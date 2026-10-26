import { parseHubFrame, realtimeTicketResponseSchema } from "@workerbee/realtime"
import { z } from "zod"

const bootstrapSchema = z.object({
  seq: z.number().int().nonnegative(),
  workspace: z.object({ id: z.string(), slug: z.string() }),
  teams: z.array(z.object({ id: z.string(), key: z.string() })),
  states: z.array(
    z.object({ id: z.string(), teamId: z.string(), category: z.string() }),
  ),
  issues: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      identifier: z.string(),
      stateId: z.string(),
      version: z.number().int(),
    }),
  ),
})

const workspaceSchema = z.object({ id: z.string(), slug: z.string() })
const workspaceListSchema = z.object({ workspaces: z.array(workspaceSchema) })
const issueResponseSchema = z.object({
  issue: z.object({ id: z.string(), identifier: z.string() }),
})

function requiredEnv(name: string): string {
  const value = process.env[name]

  if (value === undefined || value === "") {
    throw new Error(`Missing ${name}`)
  }

  return value
}

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

async function request(
  baseUrl: string,
  path: string,
  options: {
    readonly method?: string
    readonly body?: unknown
    readonly cookie?: string
    readonly workspace?: string
  } = {},
): Promise<Response> {
  const headers = new Headers({ origin: baseUrl })

  if (options.body !== undefined) {
    headers.set("content-type", "application/json")
  }

  if (options.cookie !== undefined) {
    headers.set("cookie", options.cookie)
  }

  if (options.workspace !== undefined) {
    headers.set("x-workerbee-workspace", options.workspace)
  }

  return fetch(new URL(path, baseUrl), {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
}

async function responseJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json()

  return schema.parse(body)
}

async function waitForApi(baseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(new URL("/api/v1/protocol", baseUrl))

      if (response.ok) {
        return
      }
    } catch {
      // Wait for the custom domain certificate and route to become ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }

  throw new Error("Dev API did not become reachable within two minutes")
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))

  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function smoke(): Promise<void> {
  const baseUrl = new URL(requiredEnv("WORKERBEE_URL")).origin
  await waitForApi(baseUrl)
  const authSecret = requiredEnv("BETTER_AUTH_SECRET")
  const hostnameFingerprint = (await digest(baseUrl)).slice(0, 8)
  const secretFingerprint = (await digest(authSecret)).slice(0, 8)
  const slug = `deployment-smoke-${hostnameFingerprint}-${secretFingerprint}`
  const email = `workerbee-smoke+${hostnameFingerprint}-${secretFingerprint}@example.com`
  const password = await digest(`${authSecret}:${baseUrl}:smoke`)

  const signUp = await request(baseUrl, "/api/auth/sign-up/email", {
    method: "POST",
    body: { name: "Workerbee smoke test", email, password },
  })

  if (!signUp.ok) {
    const signIn = await request(baseUrl, "/api/auth/sign-in/email", {
      method: "POST",
      body: { email, password },
    })

    if (!signIn.ok) {
      throw new Error(`Smoke account sign-in failed with HTTP ${signIn.status}`)
    }
  }

  const firstSignIn = await request(baseUrl, "/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password },
  })
  const firstCookie = cookieHeader(firstSignIn)

  if (!firstSignIn.ok || firstCookie === "") {
    throw new Error(`First smoke client could not sign in: HTTP ${firstSignIn.status}`)
  }

  const membershipsResponse = await request(baseUrl, "/api/v1/workspaces", {
    cookie: firstCookie,
  })
  const { workspaces } = await responseJson(membershipsResponse, workspaceListSchema)

  if (!membershipsResponse.ok) {
    throw new Error(`Smoke workspace lookup failed with HTTP ${membershipsResponse.status}`)
  }

  let workspace = workspaces.find((candidate) => candidate.slug === slug)

  if (workspace === undefined) {
    const created = await request(baseUrl, "/api/v1/workspaces", {
      method: "POST",
      cookie: firstCookie,
      body: { name: "Deployment smoke", slug },
    })

    workspace = await responseJson(created, workspaceSchema)

    if (!created.ok) {
      throw new Error(`Smoke workspace creation failed with HTTP ${created.status}`)
    }
  }

  const secondSignIn = await request(baseUrl, "/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password },
  })
  const secondCookie = cookieHeader(secondSignIn)

  if (!secondSignIn.ok || secondCookie === "") {
    throw new Error(`Second smoke client could not sign in: HTTP ${secondSignIn.status}`)
  }

  const bootstrapResponse = await request(baseUrl, "/api/v1/bootstrap", {
    cookie: secondCookie,
    workspace: workspace.slug,
  })
  const bootstrap = await responseJson(bootstrapResponse, bootstrapSchema)

  if (!bootstrapResponse.ok) {
    throw new Error(`Second smoke client bootstrap failed with HTTP ${bootstrapResponse.status}`)
  }

  const team = bootstrap.teams.find((candidate) => candidate.key === "ENG")
  const todo = bootstrap.states.find(
    (state) => state.teamId === team?.id && state.category === "unstarted",
  )
  const done = bootstrap.states.find(
    (state) => state.teamId === team?.id && state.category === "done",
  )

  if (team === undefined || todo === undefined || done === undefined) {
    throw new Error("Smoke workspace is missing its default team or states")
  }

  const ticketResponse = await request(baseUrl, "/api/v1/realtime-ticket", {
    method: "POST",
    cookie: secondCookie,
    workspace: workspace.slug,
  })
  const { ticket } = await responseJson(ticketResponse, realtimeTicketResponseSchema)

  if (!ticketResponse.ok) {
    throw new Error(`Second smoke client could not get a ticket: HTTP ${ticketResponse.status}`)
  }

  const socketUrl = new URL(`/api/v1/realtime/${workspace.id}`, baseUrl)
  socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:"
  socketUrl.searchParams.set("ticket", ticket)
  socketUrl.searchParams.set("since", String(bootstrap.seq))

  const socket = new WebSocket(socketUrl)
  const liveIssue = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("No live issue update arrived within 30 seconds")), 30_000)

    socket.onopen = () => {
      const existing = bootstrap.issues.find((issue) => issue.title === "Deployment smoke issue")

      void (async () => {
        const writeResponse =
          existing === undefined
            ? await request(baseUrl, "/api/v1/issues", {
                method: "POST",
                cookie: firstCookie,
                workspace: workspace.slug,
                body: {
                  teamId: team.id,
                  stateId: todo.id,
                  title: "Deployment smoke issue",
                },
              })
            : await request(baseUrl, `/api/v1/issues/${existing.id}`, {
                method: "PATCH",
                cookie: firstCookie,
                workspace: workspace.slug,
                body: {
                  stateId: existing.stateId === todo.id ? done.id : todo.id,
                  version: existing.version,
                },
              })

        if (!writeResponse.ok) {
          throw new Error(`First smoke client write failed with HTTP ${writeResponse.status}`)
        }

        if (existing === undefined) {
          await responseJson(writeResponse, issueResponseSchema)
        }
      })().catch((error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      })
    }

    socket.onmessage = (event) => {
      try {
        const frame = parseHubFrame(JSON.parse(String(event.data)))

        if (
          frame.type === "changeset" &&
          frame.changeset.changes.some((change) => change.entity === "issue")
        ) {
          clearTimeout(timeout)
          const issueChange = frame.changeset.changes.find((change) => change.entity === "issue")

          if (issueChange !== undefined) {
            resolve(issueChange.id)
          }
        }
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
      }
    }

    socket.onerror = () => {
      clearTimeout(timeout)
      reject(new Error("Second smoke client WebSocket failed"))
    }
  })

  try {
    const issueId = await liveIssue
    const issue = bootstrap.issues.find((candidate) => candidate.id === issueId)

    console.log(`Smoke passed for ${workspace.slug}, live issue ${issue?.identifier ?? issueId}`)
  } finally {
    socket.close(1000, "Smoke complete")
  }
}

await smoke()
