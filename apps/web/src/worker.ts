export type Env = WebEnv

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return env.API.fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
}
