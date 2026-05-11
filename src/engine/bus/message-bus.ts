import type { SimEvent } from '../fsm/types'

export class MessageBus {
  private handlers = new Map<string, Set<(e: SimEvent) => void>>()

  publish(event: SimEvent): void {
    this.handlers.get(event.type)?.forEach(h => h(event))
  }

  route(to: string, event: SimEvent): void {
    // Targeted delivery — same as publish for now
    this.publish(event)
  }

  subscribe(type: string, handler: (e: SimEvent) => void): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }
}