/**
 * Pageviews drop the query string so issue search terms never leave the
 * browser. Path segments such as issue identifiers are safe to keep.
 */
export function pageviewUrl(path: string, origin: string): string {
  const url = new URL(path, origin)

  return `${url.origin}${url.pathname}`
}
