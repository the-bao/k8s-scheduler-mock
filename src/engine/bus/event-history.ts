import type { SimEvent } from '../fsm/types'

export class EventHistory {
  private events: SimEvent[] = []

  record(event: SimEvent): void {
    this.events.push(event)
  }

  getAll(): SimEvent[] {
    return [...this.events]
  }

  getUpTo(index: number): SimEvent[] {
    return this.events.slice(0, index + 1)
  }

  clear(): void {
    this.events = []
  }
}