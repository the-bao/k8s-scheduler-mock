import type { SimEvent, ActorContext } from './types'
import type { FSMachine } from './xstate-adapter'
import type { MessageBus } from '../bus/message-bus'

export abstract class Actor<S extends string, _E extends string> {
  readonly id: string
  protected bus: MessageBus | null = null
  private mailbox: SimEvent[] = []
  private draining = false
  private fsm: FSMachine<S>

  constructor(id: string, machine: FSMachine<S>) {
    this.id = id
    this.fsm = machine
  }

  receive(event: SimEvent): void {
    console.log(`[${this.id}] receive:`, event.type)
    this.mailbox.push(event)
    if (!this.draining) this.drain()
  }

  subscribe(bus: MessageBus, _channel: string): void {
    this.bus = bus
  }

  protected getState(): S {
    return this.fsm.getState()
  }

  reset(): void {
    this.mailbox = []
    this.draining = false
  }

  protected abstract makeCtx(): ActorContext
  protected abstract onTransition(state: S, event: SimEvent): void

  private drain(): void {
    this.draining = true
    while (this.mailbox.length) {
      const e = this.mailbox.shift()!
      const newState = this.fsm.send(e)
      console.log(`[${this.id}] drain: ${e.type} -> state: ${newState}`)
      this.onTransition(newState, e)
    }
    this.draining = false
  }
}