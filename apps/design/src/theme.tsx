import { Monitor, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@workerbee/ui"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "wb-theme"

function systemIsDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function apply(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && systemIsDark())
  document.documentElement.classList.toggle("dark", dark)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)

    return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark"
  })

  useEffect(() => {
    apply(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (theme !== "system") {
      return
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => apply("system")

    media.addEventListener("change", onChange)

    return () => media.removeEventListener("change", onChange)
  }, [theme])

  return { theme, setTheme }
}

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function ThemeToggle({
  theme,
  onChange,
}: {
  readonly theme: Theme
  readonly onChange: (theme: Theme) => void
}) {
  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-sm border border-line bg-sunken p-0.5"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const active = theme === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring flex h-6 items-center gap-1.5 rounded-xs px-2 text-xs transition-colors",
              active
                ? "bg-surface text-fg shadow-sm"
                : "text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
