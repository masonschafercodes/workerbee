import { PRIORITIES, type Priority } from "@workerbee/domain"

export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value)
}

export function parseNumber(value: string | undefined, fallback: number): number | null {
  if (value === undefined || value === "") {
    return fallback
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}
