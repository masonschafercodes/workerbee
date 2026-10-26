import { normalizeHostname, normalizeHostnameFromState } from "./hostname"

const fromState = process.argv.includes("--from-state")
const argumentIndex = fromState ? process.argv.indexOf("--from-state") + 1 : 2
const input = process.argv[argumentIndex]

if (input === undefined) {
  throw new Error("Pass a hostname")
}

console.log(fromState ? normalizeHostnameFromState(input) : normalizeHostname(input))
