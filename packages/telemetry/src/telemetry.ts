import { PostHog } from "posthog-node"
import { sendLog, type Attributes, type LogLevel } from "./logs"

export type { Attributes, LogLevel } from "./logs"

export type TelemetryConfig = {
  readonly key: string | undefined
  readonly host: string | undefined
  readonly service: string
  readonly waitUntil: (promise: Promise<unknown>) => void
}

export type Telemetry = {
  capture(event: string, distinctId: string, properties?: Attributes): void
  captureException(error: unknown, distinctId?: string, properties?: Attributes): void
  log(level: LogLevel, message: string, attributes?: Attributes): void
}

const DEFAULT_HOST = "https://us.i.posthog.com"

const noop: Telemetry = {
  capture() {},
  captureException() {},
  log() {},
}

function eventProperties(attributes: Attributes): Record<string, string | number> {
  const properties: Record<string, string | number> = {}

  for (const [key, value] of Object.entries(attributes)) {
    if (value == null) {
      continue
    }

    properties[key] = typeof value === "boolean" ? String(value) : value
  }

  return properties
}

/**
 * PostHog ingestion is best effort. Telemetry failures never fail a request
 * and an empty key disables it, so tests and local runs need no configuration.
 */
export function createTelemetry(config: TelemetryConfig): Telemetry {
  const key = config.key?.trim()

  if (key === undefined || key === "") {
    return noop
  }

  const host = config.host?.trim() || DEFAULT_HOST
  const client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 })
  const schedule = (promise: Promise<unknown>) => {
    config.waitUntil(promise.catch(() => {}))
  }

  return {
    capture(event, distinctId, properties = {}) {
      schedule(
        client.captureImmediate({
          event,
          distinctId,
          properties: eventProperties(properties),
        }),
      )
    },
    captureException(error, distinctId, properties = {}) {
      schedule(
        client.captureExceptionImmediate(error, distinctId, eventProperties(properties)),
      )
    },
    log(level, message, attributes = {}) {
      schedule(sendLog(host, key, config.service, level, message, attributes))
    },
  }
}
