const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function relativeTime(value: string): string {
  const time = new Date(value).getTime()

  if (Number.isNaN(time)) {
    return ""
  }

  const minutes = Math.round((time - Date.now()) / 60_000)

  if (Math.abs(minutes) < 60) {
    return relative.format(minutes, "minute")
  }

  const hours = Math.round(minutes / 60)

  if (Math.abs(hours) < 24) {
    return relative.format(hours, "hour")
  }

  const days = Math.round(hours / 24)

  if (Math.abs(days) < 30) {
    return relative.format(days, "day")
  }

  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "")

  return slug === "" ? "workspace" : slug
}

export function stateCategoryLabel(category: string): string {
  switch (category) {
    case "backlog":
      return "Backlog"
    case "unstarted":
      return "Todo"
    case "started":
      return "In progress"
    case "done":
      return "Done"
    case "canceled":
      return "Canceled"
    default:
      return category
  }
}
