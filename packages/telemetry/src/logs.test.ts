import { describe, expect, test } from "bun:test"
import { logsEndpoint, logPayload } from "./logs"
import { createTelemetry } from "./telemetry"

function record(payload: unknown): Record<string, unknown> {
  const body = payload as {
    resourceLogs: {
      resource: { attributes: { key: string; value: { stringValue: string } }[] }
      scopeLogs: { logRecords: Record<string, unknown>[] }[]
    }[]
  }
  const resource = body.resourceLogs[0]

  if (resource === undefined) {
    throw new Error("missing resource")
  }

  expect(resource.resource.attributes).toEqual([
    { key: "service.name", value: { stringValue: "workerbee-api" } },
  ])

  const logRecord = resource.scopeLogs[0]?.logRecords[0]

  if (logRecord === undefined) {
    throw new Error("missing log record")
  }

  return logRecord
}

describe("PostHog logs", () => {
  test("builds an OTLP record with severity and attributes", () => {
    const logRecord = record(
      logPayload(
        "workerbee-api",
        "error",
        "queue publish failed",
        { path: "/api/v1/issues", status: 500, retryable: true, empty: null },
        1_700_000_000_000,
      ),
    )

    expect(logRecord.timeUnixNano).toBe("1700000000000000000")
    expect(logRecord.severityNumber).toBe(17)
    expect(logRecord.severityText).toBe("ERROR")
    expect(logRecord.body).toEqual({ stringValue: "queue publish failed" })
    expect(logRecord.attributes).toEqual([
      { key: "path", value: { stringValue: "/api/v1/issues" } },
      { key: "status", value: { intValue: "500" } },
      { key: "retryable", value: { boolValue: true } },
    ])
  })

  test("builds the ingest endpoint with an encoded token", () => {
    expect(logsEndpoint("https://us.i.posthog.com/", "phc_a b")).toBe(
      "https://us.i.posthog.com/i/v1/logs?token=phc_a%20b",
    )
  })

  test("stays inert when no key is configured", () => {
    let scheduled = 0

    const telemetry = createTelemetry({
      key: "",
      host: "https://us.i.posthog.com",
      service: "workerbee-api",
      waitUntil: () => {
        scheduled += 1
      },
    })

    telemetry.capture("issue created", "actor-1")
    telemetry.captureException(new Error("boom"))
    telemetry.log("error", "boom")

    expect(scheduled).toBe(0)
  })
})
