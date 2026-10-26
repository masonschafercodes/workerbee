import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const accountId = process.env.TF_VAR_account_id

if (accountId === undefined || !/^[0-9a-f]{32}$/i.test(accountId)) {
  throw new Error("TF_VAR_account_id must be a 32-character Cloudflare account id")
}

const examplePath = resolve(root, "infra/envs/dev/backend.hcl.example")
const backendPath = resolve(root, "infra/envs/dev/backend.hcl")
const template = await readFile(examplePath, "utf8")

if (!template.includes("<ACCOUNT_ID>")) {
  throw new Error(`Expected <ACCOUNT_ID> placeholder in ${examplePath}`)
}

const backend = template.replaceAll("<ACCOUNT_ID>", accountId)
const temporary = `${backendPath}.${process.pid}.tmp`

await mkdir(dirname(backendPath), { recursive: true })
await writeFile(temporary, backend, { mode: 0o600 })
await rename(temporary, backendPath)
