import { apiKey } from "@better-auth/api-key"
import { schema, type Database } from "@workerbee/db"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { jwt, organization } from "better-auth/plugins"

export type AuthDeps = {
  readonly db: Database
  readonly secret: string
  readonly baseURL: string
}

/**
 * Authentication only. Authorization lives in @workerbee/domain/policy.
 * organization maps to our workspace. apiKey covers agents and CI.
 */
export function createAuth({ db, secret, baseURL }: AuthDeps) {
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters")
  }

  return betterAuth({
    appName: "Workerbee",
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [organization(), apiKey(), jwt()],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db.insert(schema.actor).values({ id: user.id, kind: "user" })
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
