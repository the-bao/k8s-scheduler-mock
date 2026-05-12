export type SimEvent = {
  type: string
  from?: string
  to?: string
  payload?: unknown
  ts?: number
}

export interface ActorContext {
  actorId: string
  bus: MessageBusLike
  [key: string]: unknown
}

export interface MessageBusLike {
  publish(event: SimEvent): void
  route(to: string, event: SimEvent): void
}