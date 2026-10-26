import { actorId, workspaceId, type ActorId, type WorkspaceId } from "@workerbee/domain"
import { changesetSchema } from "@workerbee/sync"
import { z } from "zod"

const base64Url = {
  encode(value: Uint8Array): string {
    let binary = ""

    for (const byte of value) {
      binary += String.fromCharCode(byte)
    }

    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
  },
  decode(value: string): Uint8Array {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))

    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  },
}

const ticketPayloadSchema = z.object({
  audience: z.literal("workerbee-realtime"),
  workspaceId: z.string().min(1).max(64),
  actorId: z.string().min(1).max(64),
  teamIds: z.union([z.literal("all"), z.array(z.string().min(1).max(64)).max(500)]),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
})

export type RealtimeTicket = {
  readonly workspaceId: WorkspaceId
  readonly actorId: ActorId
  readonly teamIds: "all" | readonly string[]
  readonly issuedAt: number
  readonly expiresAt: number
}

export type RealtimeTicketClaims = {
  readonly workspaceId: WorkspaceId
  readonly actorId: ActorId
  readonly teamIds: "all" | readonly string[]
}

const encoder = new TextEncoder()

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

export async function signRealtimeTicket(
  claims: RealtimeTicketClaims,
  secret: string,
  now = Date.now(),
  lifetimeMs = 60_000,
): Promise<string> {
  const payload = ticketPayloadSchema.parse({
    audience: "workerbee-realtime",
    workspaceId: claims.workspaceId,
    actorId: claims.actorId,
    teamIds: claims.teamIds,
    issuedAt: now,
    expiresAt: now + lifetimeMs,
  })
  const encodedPayload = base64Url.encode(encoder.encode(JSON.stringify(payload)))
  const key = await signingKey(secret)
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload))

  return `${encodedPayload}.${base64Url.encode(new Uint8Array(signature))}`
}

export async function verifyRealtimeTicket(
  token: string,
  secret: string,
  expectedWorkspaceId: WorkspaceId,
  now = Date.now(),
): Promise<RealtimeTicket | null> {
  const [encodedPayload, encodedSignature, ...rest] = token.split(".")

  if (encodedPayload === undefined || encodedSignature === undefined || rest.length > 0) {
    return null
  }

  let signature: Uint8Array
  let payload: unknown

  try {
    signature = base64Url.decode(encodedSignature)
    const decoded: unknown = JSON.parse(new TextDecoder().decode(base64Url.decode(encodedPayload)))
    payload = decoded
  } catch {
    return null
  }

  const key = await signingKey(secret)
  const signatureBuffer = new ArrayBuffer(signature.byteLength)
  new Uint8Array(signatureBuffer).set(signature)
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBuffer,
    encoder.encode(encodedPayload),
  )

  if (!validSignature) {
    return null
  }

  const parsed = ticketPayloadSchema.safeParse(payload)

  if (!parsed.success || parsed.data.expiresAt <= now || parsed.data.issuedAt > now) {
    return null
  }

  try {
    const ticketWorkspaceId = workspaceId(parsed.data.workspaceId)

    if (ticketWorkspaceId !== expectedWorkspaceId) {
      return null
    }

    return {
      workspaceId: ticketWorkspaceId,
      actorId: actorId(parsed.data.actorId),
      teamIds: parsed.data.teamIds,
      issuedAt: parsed.data.issuedAt,
      expiresAt: parsed.data.expiresAt,
    }
  } catch {
    return null
  }
}

export const queueWakeupSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  seq: z.number().int().nonnegative(),
})

export type QueueWakeup = z.infer<typeof queueWakeupSchema>

export const wireChangesetSchema = changesetSchema.extend({
  changes: z.array(changesetSchema.shape.changes.element),
})

export function parseWireChangeset(value: unknown) {
  return wireChangesetSchema.parse(value)
}

export const realtimeTicketResponseSchema = z.object({
  ticket: z.string().min(1),
  expiresAt: z.number().int().positive(),
})

export const hubFrameSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("changeset"), changeset: wireChangesetSchema }),
  z.object({ type: z.literal("reset"), reason: z.literal("gap") }),
])

export const syncResponseSchema = z.object({
  changesets: z.array(wireChangesetSchema),
})

export type HubFrame = z.infer<typeof hubFrameSchema>

export function parseHubFrame(value: unknown): HubFrame {
  return hubFrameSchema.parse(value)
}
