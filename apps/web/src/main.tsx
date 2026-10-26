import "./styles.css"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { TooltipProvider } from "@workerbee/ui"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { applySystemTheme } from "./lib/theme"
import { queryClient } from "./lib/query"
import { router } from "./router"

applySystemTheme()

const root = document.getElementById("root")

if (root === null) {
  throw new Error("Missing #root")
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
