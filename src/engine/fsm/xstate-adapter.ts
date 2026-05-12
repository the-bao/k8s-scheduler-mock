import { createMachine, createActor } from 'xstate'

import type { SimEvent } from './types'

export interface FSMachine<S extends string> {
  getState(): S
  send(event: SimEvent): S
}

export function createXStateMachine<S extends string>(
  config: { initial: S; states: Record<string, object> }
): FSMachine<S> {
  const machine = createMachine({
    id: 'fsm',
    initial: config.initial,
    states: config.states as any,
  })

  const actor = createActor(machine)
  actor.start()

  return {
    getState: (): S => {
      const snapshot = actor.getSnapshot()
      console.log('[XState] getState snapshot.value:', JSON.stringify(snapshot.value))
      const val = snapshot.value
      return (typeof val === 'string' ? val : Object.keys(val as object)[0]) as S
    },
    send: (event: unknown): S => {
      console.log('[XState] before send, state:', JSON.stringify(actor.getSnapshot().value), 'event:', JSON.stringify(event))
      actor.send(event as any)
      console.log('[XState] after send, state:', JSON.stringify(actor.getSnapshot().value))
      const snapshot = actor.getSnapshot()
      const val = snapshot.value
      return (typeof val === 'string' ? val : Object.keys(val as object)[0]) as S
    },
  }
}