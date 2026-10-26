export function applySystemTheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)")

  const apply = () => {
    const stored = localStorage.getItem("wb-theme")
    const dark = stored === "dark" || (stored !== "light" && media.matches)

    document.documentElement.classList.toggle("dark", dark)
  }

  apply()
  media.addEventListener("change", apply)

  return () => media.removeEventListener("change", apply)
}
