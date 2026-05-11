import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { EtcdStore } from '../store/etcd-store'

export class APIServerActor extends Actor<'idle' | 'validating' | 'storing' | 'broadcasting' | 'updating', string> {
  constructor(id: string, private store: EtcdStore) {
    const fsm = createXStateMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            USER_APPLY: 'validating',
            BIND_REQUEST: 'updating',
            STATUS_UPDATE: 'updating',
          },
        },
        validating: { always: [{ target: 'storing', guard: () => true }] },
        storing: { always: 'broadcasting' },
        broadcasting: { always: 'idle' },
        updating: { always: 'idle' },
      },
    })
    super(id, fsm)
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
      store: this.store,
    }
  }

  protected onTransition(state: 'idle' | 'validating' | 'storing' | 'broadcasting' | 'updating', event: SimEvent): void {
    // Handle state transitions
  }
}
