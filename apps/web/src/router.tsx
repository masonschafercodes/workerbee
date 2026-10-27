import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router"
import { api } from "./lib/api"
import { authClient } from "./lib/auth"
import { keys } from "./lib/hooks"
import { queryClient } from "./lib/query"
import { validateWorkspaceSearch } from "./lib/search"
import { IssuePage } from "./pages/issue"
import { SettingsLabelsPage } from "./pages/settings-labels"
import { NewWorkspacePage } from "./pages/new-workspace"
import { SignInPage } from "./pages/sign-in"
import { SignUpPage } from "./pages/sign-up"
import { WorkspacePage } from "./pages/workspace"

async function requireSession() {
  const session = await authClient.getSession()

  if (session.data === null) {
    throw redirect({ to: "/sign-in" })
  }
}

function RootComponent() {
  return <Outlet />
}

function NotFoundComponent() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 text-center">
      <div className="grid gap-2">
        <h1 className="text-lg font-medium text-fg">Page not found</h1>
        <Link to="/" className="text-sm text-accent hover:underline">
          Back to issues
        </Link>
      </div>
    </div>
  )
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const session = await authClient.getSession()

    if (session.data === null) {
      throw redirect({ to: "/sign-in" })
    }

    const workspaces = await queryClient.ensureQueryData({
      queryKey: keys.workspaces,
      queryFn: api.workspaces,
    })
    const first = workspaces[0]

    if (first === undefined) {
      throw redirect({ to: "/workspaces/new" })
    }

    throw redirect({
      to: "/w/$workspace",
      params: { workspace: first.slug },
      search: { view: "all", q: "", team: undefined },
    })
  },
})

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  beforeLoad: async () => {
    const session = await authClient.getSession()

    if (session.data !== null) {
      throw redirect({ to: "/" })
    }
  },
  component: SignInPage,
})

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  beforeLoad: async () => {
    const session = await authClient.getSession()

    if (session.data !== null) {
      throw redirect({ to: "/" })
    }
  },
  component: SignUpPage,
})

const newWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/new",
  beforeLoad: requireSession,
  component: NewWorkspacePage,
})

export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$workspace",
  validateSearch: validateWorkspaceSearch,
  beforeLoad: requireSession,
  component: WorkspacePage,
})

const issueRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "issues/$identifier",
  beforeLoad: requireSession,
  component: IssuePage,
})

const settingsLabelsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "settings/labels",
  beforeLoad: requireSession,
  component: SettingsLabelsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  newWorkspaceRoute,
  workspaceRoute.addChildren([issueRoute, settingsLabelsRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
