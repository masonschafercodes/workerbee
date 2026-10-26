import { apiKey } from "@better-auth/api-key"
import { schema, type Database } from "@workerbee/db"
import { newId } from "@workerbee/domain"
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
    advanced: {
      database: {
        // Domain ids are UUIDv7 so every table shares one time-ordered scheme.
        // Session and verification values are secrets, so they keep UUIDv4 entropy.
        generateId: ({ model }) =>
          model === "session" || model === "verification"
            ? crypto.randomUUID()
            : newId(),
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      // The signed cache skips the session lookup on each request. Membership
      // and role still come from the database, so authorization stays current.
      cookieCache: { enabled: true, maxAge: 60 },
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
