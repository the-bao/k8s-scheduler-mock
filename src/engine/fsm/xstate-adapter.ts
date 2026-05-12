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
    getState: () => {
      const snapshot = actor.getSnapshot()
      return snapshot.value as S
    },
    send: (event: unknown) => {
      actor.send(event as any)
      const snapshot = actor.getSnapshot()
      return snapshot.value as S
    },
  }
}