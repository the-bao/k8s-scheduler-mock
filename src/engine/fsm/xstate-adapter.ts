import { createMachine, createActor, type Actor, type Snapshot } from 'xstate'

export interface FSMachine<S extends string> {
  getState(): S
  send(event: unknown): S | null
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
      const snapshot = actor.getSnapshot() as Snapshot<{ value: S }>
      return snapshot.value
    },
    send: (event: unknown) => {
      actor.send(event as any)
      const snapshot = actor.getSnapshot() as Snapshot<{ value: S }>
      return snapshot.value
    },
  }
}