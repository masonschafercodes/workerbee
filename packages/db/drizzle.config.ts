import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/workerbee"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
