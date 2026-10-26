import type { PostHog } from "posthog-js"
import { useEffect, useState } from "react"
import { pageviewUrl } from "./pageview"

const key = import.meta.env.VITE_POSTHOG_KEY
const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com"
const configured = typeof key === "string" && key !== ""

let client: PostHog | null = null
let enabled = false
const queued: ((posthog: PostHog) => void)[] = []
const readyListeners = new Set<() => void>()

/**
 * posthog-js is large, so it loads in its own chunk after first paint. Calls
 * made before it finishes are queued and replayed once the SDK is ready.
 */
export function initAnalytics(): void {
  if (!configured) {
    return
  }

  enabled = true

  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        capture_exceptions: true,
      })

      client = posthog
      for (const run of queued.splice(0)) {
        run(posthog)
      }
      for (const listener of readyListeners) {
        listener()
      }
      readyListeners.clear()
    })
    .catch(() => {
      enabled = false
    })
}

function withClient(run: (posthog: PostHog) => void): void {
  if (client !== null) {
    run(client)
    return
  }

  if (enabled) {
    queued.push(run)
  }
}

export function capturePageview(path: string): void {
  withClient((posthog) => {
    posthog.capture("$pageview", {
      $current_url: pageviewUrl(path, window.location.origin),
    })
  })
}

export function identifyUser(id: string, email: string, name: string): void {
  withClient((posthog) => {
    posthog.identify(id, { email, name })
  })
}

export function resetAnalytics(): void {
  withClient((posthog) => {
    posthog.reset()
  })
}

function flagValue(flag: string, fallback: boolean): boolean {
  if (client === null) {
    return fallback
  }

  const value = client.getFeatureFlag(flag)

  if (typeof value === "boolean") {
    return value
  }

  return value === undefined ? fallback : Boolean(value)
}

export function useFeatureFlag(flag: string, fallback = false): boolean {
  const [value, setValue] = useState(() => flagValue(flag, fallback))

  useEffect(() => {
    if (!configured) {
      return
    }

    let unsubscribe: (() => void) | undefined
    const update = () => setValue(flagValue(flag, fallback))
    const attach = () => {
      update()
      unsubscribe = client?.onFeatureFlags(update)
    }

    if (client !== null) {
      attach()
    } else {
      readyListeners.add(attach)
    }

    return () => {
      readyListeners.delete(attach)
      unsubscribe?.()
    }
  }, [flag, fallback])

  return value
}
