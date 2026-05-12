import type { SimEvent } from '../fsm/types'

export class MessageBus {
  private _handlers = new Map<string, Set<(e: SimEvent) => void>>()

  get handlers(): Map<string, Set<(e: SimEvent) => void>> {
    return this._handlers
  }

  publish(event: SimEvent): void {
    // Publish to all handlers matching the event type
    this._handlers.get(event.type)?.forEach(h => h(event))
    // Also publish to handlers matching the 'to' field for targeted delivery
    if (event.to && event.to !== '*') {
      this._handlers.get(`to:${event.to}`)?.forEach(h => h(event))
    }
  }

  route(to: string, event: SimEvent): void {
    event.to = to
    this.publish(event)
  }

  subscribe(channel: string, handler: (e: SimEvent) => void): () => void {
    if (!this._handlers.has(channel)) this._handlers.set(channel, new Set())
    this._handlers.get(channel)!.add(handler)
    return () => this._handlers.get(channel)?.delete(handler)
  }

  unsubscribe(channel: string, handler: (e: SimEvent) => void): void {
    this._handlers.get(channel)?.delete(handler)
  }
}