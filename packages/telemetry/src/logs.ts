export type LogLevel = "debug" | "info" | "warn" | "error"

export type AttributeValue = string | number | boolean

export type Attributes = Record<string, AttributeValue | null | undefined>

const SEVERITY: Record<LogLevel, { readonly number: number; readonly text: string }> = {
  debug: { number: 5, text: "DEBUG" },
  info: { number: 9, text: "INFO" },
  warn: { number: 13, text: "WARN" },
  error: { number: 17, text: "ERROR" },
}

function attributeValue(value: AttributeValue): Record<string, unknown> {
  if (typeof value === "number") {
    return { intValue: String(Math.trunc(value)) }
  }

  if (typeof value === "boolean") {
    return { boolValue: value }
  }

  return { stringValue: value }
}

/** PostHog Logs ingests OTLP/HTTP JSON. */
export function logPayload(
  service: string,
  level: LogLevel,
  message: string,
  attributes: Attributes,
  now: number = Date.now(),
): unknown {
  const timestamp = `${now}000000`

  return {
    resourceLogs: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: service } }],
        },
        scopeLogs: [
          {
            scope: { name: "@workerbee/telemetry" },
            logRecords: [
              {
                timeUnixNano: timestamp,
                observedTimeUnixNano: timestamp,
                severityNumber: SEVERITY[level].number,
                severityText: SEVERITY[level].text,
                body: { stringValue: message },
                attributes: Object.entries(attributes)
                  .filter((entry): entry is [string, AttributeValue] => entry[1] != null)
                  .map(([key, value]) => ({ key, value: attributeValue(value) })),
              },
            ],
          },
        ],
      },
    ],
  }
}

export function logsEndpoint(host: string, key: string): string {
  return `${host.replace(/\/$/, "")}/i/v1/logs?token=${encodeURIComponent(key)}`
}

export async function sendLog(
  host: string,
  key: string,
  service: string,
  level: LogLevel,
  message: string,
  attributes: Attributes,
): Promise<void> {
  await fetch(logsEndpoint(host, key), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(logPayload(service, level, message, attributes)),
  })
}
