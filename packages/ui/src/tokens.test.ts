import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/i

/**
 * Components must use semantic utilities. Raw color values belong in
 * styles.css so a theme change is one file, not a sweep.
 */
test("components never hardcode color values", async () => {
  const glob = new Bun.Glob("components/**/*.tsx")
  const offenders: string[] = []

  for await (const file of glob.scan(import.meta.dir)) {
    const source = await readFile(join(import.meta.dir, file), "utf8")

    if (RAW_COLOR.test(source)) {
      offenders.push(file)
    }
  }

  expect(offenders).toEqual([])
})
