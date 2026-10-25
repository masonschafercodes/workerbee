import type { ActorId } from "./ids"

export const ACTOR_KINDS = ["user", "agent"] as const

export type ActorKind = (typeof ACTOR_KINDS)[number]

export type HumanActor = {
  readonly id: ActorId
  readonly kind: "user"
}

export type AgentActor = {
  readonly id: ActorId
  readonly kind: "agent"
}

export type Actor = HumanActor | AgentActor

export function actor(id: ActorId, kind: "user"): HumanActor
export function actor(id: ActorId, kind: "agent"): AgentActor
export function actor(id: ActorId, kind: ActorKind): Actor {
  return { id, kind }
}

export function isAgent(value: Actor): value is AgentActor {
  return value.kind === "agent"
}
