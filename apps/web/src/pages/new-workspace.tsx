import { useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { Button, TextField } from "@workerbee/ui"
import { AuthLayout } from "../components/auth-layout"
import { api } from "../lib/api"
import { authClient } from "../lib/auth"
import { slugify } from "../lib/format"
import { keys } from "../lib/hooks"
import { queryClient } from "../lib/query"

export function NewWorkspacePage() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const slug = slugify(name)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (name.trim() === "") {
      setError("Give the workspace a name.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      await api.createWorkspace({ name: name.trim(), slug })
      await queryClient.invalidateQueries({ queryKey: keys.workspaces })
      await navigate({
        to: "/w/$workspace",
        params: { workspace: slug },
        search: { view: "all", q: "", team: undefined },
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the workspace")
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    await authClient.signOut()
    queryClient.clear()
    await navigate({ to: "/sign-in" })
  }

  return (
    <AuthLayout
      title="Create a workspace"
      description="A workspace holds your teams, issues, and agents. You can add more later."
      footer={
        <button type="button" onClick={() => void signOut()} className="text-accent hover:underline">
          Sign out
        </button>
      }
    >
      <form onSubmit={submit} className="grid gap-3">
        <TextField
          label="Workspace name"
          autoFocus
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          description={`URL: /w/${slug}`}
        />
        {error !== null ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" loading={loading} className="mt-1">
          Create workspace
        </Button>
      </form>
    </AuthLayout>
  )
}
