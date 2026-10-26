import { Link, useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { Button, TextField } from "@workerbee/ui"
import { AuthLayout } from "../components/auth-layout"
import { authClient } from "../lib/auth"

export function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await authClient.signIn.email({ email, password })

      if (result.error !== null) {
        setError(result.error.message ?? "Could not sign in")
        return
      }

      await navigate({ to: "/" })
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Use the account you created for this Workerbee instance."
      footer={
        <>
          New here?{" "}
          <Link to="/sign-up" className="text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-3">
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error !== null ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" loading={loading} className="mt-1">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
