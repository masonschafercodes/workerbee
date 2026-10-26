import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { normalizeHostname, normalizeHostnameFromState } from "./hostname"
import { z } from "zod"

const root = resolve(import.meta.dir, "..")
const bindingsPath = resolve(root, "infra/generated/bindings.dev.jsonc")
const examplePath = resolve(root, "infra/generated/bindings.dev.jsonc.example")

const bindingsSchema = z.object({
  account_id: z.string().regex(/^[0-9a-f]{32}$/i),
  hyperdrive_id: z.string().min(1),
  sync_queue_name: z.string().min(1),
  dead_letter_queue_name: z.string().min(1),
  web_hostname: z.string(),
})
const apiConfigSchema = z
  .object({
    account_id: z.string(),
    hyperdrive: z.array(z.object({ binding: z.string(), id: z.string() })),
    queues: z.object({ producers: z.array(z.object({ binding: z.string(), queue: z.string() })) }),
    vars: z.record(z.string(), z.string()),
  })
  .passthrough()
const hubConfigSchema = z
  .object({
    account_id: z.string(),
    hyperdrive: z.array(z.object({ binding: z.string(), id: z.string() })),
    queues: z.object({
      consumers: z.array(
        z.object({ queue: z.string(), dead_letter_queue: z.string() }).passthrough(),
      ),
    }),
  })
  .passthrough()
const webConfigSchema = z.object({ account_id: z.string() }).passthrough()

function option(name: string): string | undefined {
  const index = Bun.argv.indexOf(name)

  if (index < 0) {
    return undefined
  }

  const value = Bun.argv[index + 1]

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Expected a value after ${name}`)
  }

  return value
}

function runTofuOutput(name: string): unknown {
  const result = Bun.spawnSync({
    cmd: ["tofu", "-chdir=infra/envs/dev", "output", "-json", name],
    cwd: root,
    stdout: "pipe",
    stderr: "inherit",
  })

  if (result.exitCode !== 0) {
    throw new Error(`Could not read OpenTofu output ${name}. Apply infra/envs/dev first.`)
  }

  return JSON.parse(result.stdout.toString())
}

async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, contents)
  await rename(temporary, path)
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"))
}

async function renderConfigs(bindings: z.infer<typeof bindingsSchema>): Promise<void> {
  const api = apiConfigSchema.parse(await readJson(resolve(root, "apps/api/wrangler.jsonc")))
  const hub = hubConfigSchema.parse(await readJson(resolve(root, "apps/hub/wrangler.jsonc")))
  const web = webConfigSchema.parse(await readJson(resolve(root, "apps/web/wrangler.jsonc")))

  api.account_id = bindings.account_id
  api.hyperdrive = api.hyperdrive.map((binding) => ({ ...binding, id: bindings.hyperdrive_id }))
  api.queues.producers = api.queues.producers.map((binding) => ({
    ...binding,
    queue: bindings.sync_queue_name,
  }))
  api.vars.BETTER_AUTH_URL =
    bindings.web_hostname === "" ? "http://localhost:5173" : `https://${bindings.web_hostname}`

  hub.account_id = bindings.account_id
  hub.hyperdrive = hub.hyperdrive.map((binding) => ({ ...binding, id: bindings.hyperdrive_id }))
  hub.queues.consumers = hub.queues.consumers.map((consumer) => ({
    ...consumer,
    queue: bindings.sync_queue_name,
    dead_letter_queue: bindings.dead_letter_queue_name,
  }))

  web.account_id = bindings.account_id

  const generated = [
    [resolve(root, "apps/api/wrangler.generated.jsonc"), api],
    [resolve(root, "apps/hub/wrangler.generated.jsonc"), hub],
    [resolve(root, "apps/web/wrangler.generated.jsonc"), web],
  ] as const

  for (const [path, config] of generated) {
    await writeAtomic(path, `${JSON.stringify(config, null, 2)}\n`)
  }
}

async function main(): Promise<void> {
  const useExample = Bun.argv.includes("--example")
  const fromTofu = Bun.argv.includes("--from-tofu")
  const checkTofu = Bun.argv.includes("--check-tofu")
  const hostnameOverride = option("--hostname")
  const tofuModes = Number(fromTofu) + Number(checkTofu)

  if (useExample && tofuModes > 0) {
    throw new Error("Choose either --example or an OpenTofu mode")
  }

  if (tofuModes > 1 || (hostnameOverride !== undefined && !fromTofu)) {
    throw new Error("--hostname can only be used with --from-tofu")
  }

  let bindings: z.infer<typeof bindingsSchema>

  if (useExample) {
    bindings = bindingsSchema.parse(await readJson(examplePath))
  } else if (fromTofu || checkTofu) {
    const tofuBindings = bindingsSchema.omit({ web_hostname: true }).parse(
      runTofuOutput("wrangler_bindings"),
    )
    const stateHostname = z.string().parse(runTofuOutput("web_hostname"))
    const fromState = bindingsSchema.parse({
      ...tofuBindings,
      web_hostname:
        hostnameOverride === undefined
          ? normalizeHostnameFromState(stateHostname)
          : normalizeHostname(hostnameOverride),
    })

    if (checkTofu) {
      bindings = bindingsSchema.parse(await readJson(bindingsPath))

      if (JSON.stringify(bindings) !== JSON.stringify(fromState)) {
        throw new Error("infra/generated/bindings.dev.jsonc does not match OpenTofu outputs")
      }
    } else {
      bindings = fromState
      await writeAtomic(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`)
    }
  } else {
    bindings = bindingsSchema.parse(await readJson(bindingsPath))
  }

  await renderConfigs(bindings)
}

await main()
