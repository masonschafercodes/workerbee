import type { Auth } from "@workerbee/auth"
import type { Database } from "@workerbee/db"
import type { ChangePublisher, HubRouter } from "@workerbee/realtime"
import type { Telemetry } from "@workerbee/telemetry"

export type AppDeps = {
  readonly auth: Auth
  readonly db: Database
  readonly origin: string
  readonly telemetry: Telemetry
  readonly realtime: {
    readonly secret: string
    readonly publisher: ChangePublisher
    readonly hub: HubRouter
  }
}
