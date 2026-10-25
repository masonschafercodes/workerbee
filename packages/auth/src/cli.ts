// Entry point for `auth generate`. The schema generator only inspects the
// config, so this uses a lazy connection that never opens.
import { createDb } from "@workerbee/db"
import { createAuth } from "./server"

const { db } = createDb("postgres://postgres:postgres@localhost:5432/workerbee")

export const auth = createAuth({
  db,
  secret: "schema-generation-only-secret-0123456789abcdef",
  baseURL: "http://localhost:3001",
})
