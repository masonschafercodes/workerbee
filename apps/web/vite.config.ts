import { execFileSync } from "node:child_process"
import posthog from "@posthog/rollup-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const posthogApiKey = process.env.POSTHOG_API_KEY
const posthogProjectId = process.env.POSTHOG_PROJECT_ID

function releaseVersion(): string | undefined {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
    const dirty =
      execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== ""

    return dirty ? `${commit}-dirty` : commit
  } catch {
    return undefined
  }
}

const version = releaseVersion()
const sourceMaps =
  posthogApiKey !== undefined && posthogApiKey !== "" &&
  posthogProjectId !== undefined && posthogProjectId !== ""
    ? [
        posthog({
          personalApiKey: posthogApiKey,
          projectId: posthogProjectId,
          ...(process.env.POSTHOG_HOST !== undefined ? { host: process.env.POSTHOG_HOST } : {}),
          sourcemaps: {
            releaseName: "workerbee-web",
            ...(version !== undefined ? { releaseVersion: version } : {}),
            deleteAfterUpload: true,
          },
        }),
      ]
    : []

export default defineConfig({
  plugins: [react(), tailwindcss(), ...sourceMaps],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: false,
        ws: true,
      },
    },
  },
})
