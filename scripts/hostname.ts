function validateDnsHostname(value: string): string {
  const hostname = value.toLowerCase()
  const labels = hostname.split(".")
  const validLabels = labels.every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
  )

  if (hostname.length > 253 || labels.length < 2 || !validLabels) {
    throw new Error("WORKERBEE_HOSTNAME must contain valid DNS labels")
  }

  return hostname
}

function hostnameFromUrl(value: string): string {
  const url = new URL(value)
  const authority = value.slice(value.indexOf("://") + 3).split(/[/?#]/)[0] ?? ""

  if (
    url.username !== "" ||
    url.password !== "" ||
    authority.includes("@") ||
    authority.includes(":") ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("WORKERBEE_HOSTNAME URLs cannot include credentials, ports, or paths")
  }

  return validateDnsHostname(url.hostname)
}

export function normalizeHostname(input: string): string {
  const value = input.trim()

  if (/^https?:\/\//i.test(value)) {
    throw new Error("Set WORKERBEE_HOSTNAME to a bare hostname without a scheme")
  }

  return validateDnsHostname(value)
}

export function normalizeHostnameFromState(input: string): string {
  const value = input.trim()

  if (value === "") {
    return ""
  }

  return /^https?:\/\//i.test(value)
    ? hostnameFromUrl(value)
    : normalizeHostname(value)
}
