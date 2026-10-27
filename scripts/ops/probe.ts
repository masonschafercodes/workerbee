import { parseArgs } from "node:util"
import { z } from "zod"
import { defaultBaseUrl } from "./env"

const protocolSchema = z.object({ protocol: z.number().int() })

const sourceMapSchema = z.union([
  z.object({
    version: z.literal(3),
    sources: z.array(z.string()),
    mappings: z.string(),
  }),
  z.object({
    version: z.literal(3),
    sections: z.array(z.unknown()),
  }),
])

type Verdict = "pass" | "fail" | "warn"

type Check = {
  readonly name: string
  readonly verdict: Verdict
  readonly detail: string
}

const TIMEOUT_MS = 60_000
const MAX_REDIRECTS = 5

/**
 * A target response cannot send the probe to another origin. Every hop is
 * checked, so a redirect cannot reach a local or internal address either.
 */
export async function fetchSameOrigin(url: URL, baseUrl: URL): Promise<Response> {
  let current = url

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (current.origin !== baseUrl.origin) {
      throw new Error(`Refusing cross-origin request to ${current.origin}`)
    }

    const response = await fetch(current, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    })

    if (response.status < 300 || response.status >= 400) {
      return response
    }

    const location = response.headers.get("location")

    if (location === null) {
      throw new Error(`Redirect without a location from ${current.href}`)
    }

    current = new URL(location, current)
  }

  throw new Error(`Too many redirects from ${url.href}`)
}

export function isSourceMapBody(text: string): boolean {
  try {
    return sourceMapSchema.safeParse(JSON.parse(text)).success
  } catch {
    // The SPA fallback serves HTML, which is not JSON. Any non-map body is fine.
    return false
  }
}

async function checkProtocol(baseUrl: URL): Promise<Check> {
  const response = await fetchSameOrigin(new URL("/api/v1/protocol", baseUrl), baseUrl)

  if (!response.ok) {
    return { name: "protocol", verdict: "fail", detail: `HTTP ${response.status}` }
  }

  const parsed = protocolSchema.safeParse(await response.json())

  if (!parsed.success) {
    return { name: "protocol", verdict: "fail", detail: "missing integer protocol field" }
  }

  return { name: "protocol", verdict: "pass", detail: `protocol ${parsed.data.protocol}` }
}

async function checkIndex(baseUrl: URL): Promise<{ check: Check; asset?: URL }> {
  const response = await fetchSameOrigin(new URL("/", baseUrl), baseUrl)
  const contentType = response.headers.get("content-type") ?? ""

  if (!response.ok) {
    return { check: { name: "index", verdict: "fail", detail: `HTTP ${response.status}` } }
  }

  if (!contentType.includes("text/html")) {
    return { check: { name: "index", verdict: "fail", detail: `content-type ${contentType}` } }
  }

  const html = await response.text()
  const sources = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)]
    .map((match) => match[1])
    .filter((source): source is string => source !== undefined)

  const asset = sources
    .map((source) => {
      try {
        return new URL(source, baseUrl)
      } catch {
        return undefined
      }
    })
    .find(
      (url): url is URL =>
        url !== undefined && url.origin === baseUrl.origin && /\/assets\/index-.+\.js$/.test(url.pathname),
    )

  if (asset === undefined) {
    return {
      check: { name: "index", verdict: "fail", detail: "no same-origin hashed index script found" },
    }
  }

  return { check: { name: "index", verdict: "pass", detail: `served ${asset.pathname}` }, asset }
}

async function checkAsset(
  baseUrl: URL,
  asset: URL,
  requireSourceMaps: boolean,
): Promise<Check> {
  const response = await fetchSameOrigin(asset, baseUrl)
  const contentType = response.headers.get("content-type") ?? ""

  if (!response.ok) {
    return { name: "asset", verdict: "fail", detail: `HTTP ${response.status} for ${asset.pathname}` }
  }

  if (!contentType.includes("javascript")) {
    return { name: "asset", verdict: "fail", detail: `content-type ${contentType}` }
  }

  const bundle = await response.text()
  const chunkId = bundle.match(/chunkId=([a-z0-9-]+)/i)?.[1]

  if (chunkId !== undefined) {
    return { name: "asset", verdict: "pass", detail: `chunkId ${chunkId}` }
  }

  return {
    name: "asset",
    verdict: requireSourceMaps ? "fail" : "warn",
    detail: requireSourceMaps
      ? "no chunkId; source maps cannot resolve this bundle"
      : "no chunkId (build without PostHog source maps)",
  }
}

async function checkSourceMap(baseUrl: URL, asset: URL): Promise<Check> {
  const response = await fetchSameOrigin(new URL(`${asset.pathname}.map`, baseUrl), baseUrl)
  const contentType = response.headers.get("content-type") ?? ""

  if (response.status === 404) {
    return { name: "source-map", verdict: "pass", detail: "404 as expected" }
  }

  if (response.ok && isSourceMapBody(await response.text())) {
    return { name: "source-map", verdict: "fail", detail: `served ${contentType}` }
  }

  return { name: "source-map", verdict: "pass", detail: `served ${contentType || "no type"}` }
}

function printUsage(): void {
  process.stderr.write(
    [
      "Usage: ops probe [options]",
      "",
      "Checks the deployed stack end to end: protocol route, index document,",
      "hashed bundle, chunk id, and source map exposure.",
      "",
      "Options:",
      "  --url <origin>           Target origin (default: deployed dev)",
      "  --require-source-maps    Treat a missing chunkId as a failure",
      "  --json                   Print a structured report",
      "",
      "Exits 1 when any check fails.",
    ].join("\n") + "\n",
  )
}

export async function runProbeCommand(args: readonly string[]): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    allowPositionals: false,
    options: {
      url: { type: "string" },
      "require-source-maps": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })

  if (values.help === true) {
    printUsage()
    return 0
  }

  const baseUrl = new URL(values.url === undefined ? defaultBaseUrl() : values.url)
  const checks: Check[] = []

  try {
    checks.push(await checkProtocol(baseUrl))
  } catch (error) {
    checks.push({
      name: "protocol",
      verdict: "fail",
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  let asset: URL | undefined

  try {
    const index = await checkIndex(baseUrl)
    checks.push(index.check)
    asset = index.asset
  } catch (error) {
    checks.push({
      name: "index",
      verdict: "fail",
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  if (asset !== undefined) {
    const requireSourceMaps = values["require-source-maps"] === true

    try {
      checks.push(await checkAsset(baseUrl, asset, requireSourceMaps))
    } catch (error) {
      checks.push({
        name: "asset",
        verdict: "fail",
        detail: error instanceof Error ? error.message : String(error),
      })
    }

    try {
      checks.push(await checkSourceMap(baseUrl, asset))
    } catch (error) {
      checks.push({
        name: "source-map",
        verdict: "fail",
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const failed = checks.some((check) => check.verdict === "fail")

  if (values.json === true) {
    process.stdout.write(`${JSON.stringify({ baseUrl: baseUrl.href, ok: !failed, checks }, null, 2)}\n`)
  } else {
    for (const check of checks) {
      process.stdout.write(`${check.verdict.toUpperCase().padEnd(4)} ${check.name}: ${check.detail}\n`)
    }
  }

  return failed ? 1 : 0
}
