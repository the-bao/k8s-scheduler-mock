import type { Actor } from './actor'

export class ActorRegistry {
  private actors = new Map<string, Actor<unknown, unknown>>()

  register(actor: Actor<unknown, unknown>): void {
    this.actors.set(actor.id, actor)
  }

  lookup(actorId: string): Actor<unknown, unknown> | undefined {
    return this.actors.get(actorId)
  }

  getAll(): Actor<unknown, unknown>[] {
    return [...this.actors.values()]
  }

  getByType(component: string): Actor<unknown, unknown>[] {
    return [...this.actors.values()].filter(a => a.id.startsWith(component))
  }
}