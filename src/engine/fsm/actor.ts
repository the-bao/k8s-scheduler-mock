import type { SimEvent, ActorContext } from './types'
import type { FSMachine } from './xstate-adapter'

export abstract class Actor<S extends string, E extends string> {
  readonly id: string
  private mailbox: SimEvent[] = []
  private draining = false
  private fsm: FSMachine<S>

  constructor(id: string, machine: FSMachine<S>) {
    this.id = id
    this.fsm = machine
  }

  receive(event: SimEvent): void {
    this.mailbox.push(event)
    if (!this.draining) this.drain()
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
      this.fsm.send(e)
      this.onTransition(this.fsm.getState(), e)
    }
    this.draining = false
  }
}