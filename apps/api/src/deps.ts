import type { Auth } from "@workerbee/auth"
import type { Database } from "@workerbee/db"
import type { ChangePublisher, HubRouter } from "@workerbee/realtime"

export type AppDeps = {
  readonly auth: Auth
  readonly db: Database
  readonly origin: string
  readonly realtime: {
    readonly secret: string
    readonly publisher: ChangePublisher
    readonly hub: HubRouter
  }
}
