import type { SimEvent } from '../fsm/types'

export class MessageBus {
  private handlers = new Map<string, Set<(e: SimEvent) => void>>()

  publish(event: SimEvent): void {
    // Publish to all handlers matching the event type
    this.handlers.get(event.type)?.forEach(h => h(event))
    // Also publish to handlers matching the 'to' field for targeted delivery
    if (event.to && event.to !== '*') {
      this.handlers.get(`to:${event.to}`)?.forEach(h => h(event))
    }
  }

  route(to: string, event: SimEvent): void {
    event.to = to
    this.publish(event)
  }

  subscribe(channel: string, handler: (e: SimEvent) => void): () => void {
    if (!this.handlers.has(channel)) this.handlers.set(channel, new Set())
    this.handlers.get(channel)!.add(handler)
    return () => this.handlers.get(channel)?.delete(handler)
  }

  unsubscribe(channel: string, handler: (e: SimEvent) => void): void {
    this.handlers.get(channel)?.delete(handler)
  }
}