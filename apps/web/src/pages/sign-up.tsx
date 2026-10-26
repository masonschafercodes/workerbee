import { Link, useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { Button, TextField } from "@workerbee/ui"
import { AuthLayout } from "../components/auth-layout"
import { authClient } from "../lib/auth"

export function SignUpPage() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await authClient.signUp.email({ name, email, password })

      if (result.error !== null) {
        setError(result.error.message ?? "Could not create the account")
        return
      }

      await navigate({ to: "/workspaces/new" })
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create an account"
      description="This deployment is self-hosted. The first account owns the instance."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-3">
        <TextField
          label="Name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          description="At least 8 characters."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error !== null ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" loading={loading} className="mt-1">
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
