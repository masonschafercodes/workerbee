import type { Auth } from "@workerbee/auth"
import type { Database } from "@workerbee/db"

export type AppDeps = {
  readonly auth: Auth
  readonly db: Database
  readonly origin: string
}
