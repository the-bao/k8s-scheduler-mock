import type { Actor } from './actor'

export class ActorRegistry {
  private actors = new Map<string, Actor<string, string>>()

  register(actor: Actor<string, string>): void {
    this.actors.set(actor.id, actor)
  }

  lookup(actorId: string): Actor<string, string> | undefined {
    return this.actors.get(actorId)
  }

  getAll(): Actor<string, string>[] {
    return [...this.actors.values()]
  }

  getByType(component: string): Actor<string, string>[] {
    return [...this.actors.values()].filter(a => a.id.startsWith(component))
  }
}