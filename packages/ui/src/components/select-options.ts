export type SelectOption = {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

/**
 * Radix reserves the empty string for "no selection" and throws when an item
 * uses it. Duplicate values also break item identity. Fail at the boundary with
 * a readable error instead of a Radix stack trace.
 */
export function assertSelectOptions(options: readonly SelectOption[]): void {
  const seen = new Set<string>()

  for (const option of options) {
    if (option.value === "") {
      throw new Error("Select option values must not be empty")
    }

    if (seen.has(option.value)) {
      throw new Error(`Duplicate select option value: ${option.value}`)
    }

    seen.add(option.value)
  }
}
