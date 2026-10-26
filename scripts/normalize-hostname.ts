import { normalizeHostname } from "./hostname"

const input = process.argv[2]

if (input === undefined) {
  throw new Error("Pass a hostname")
}

console.log(normalizeHostname(input))
