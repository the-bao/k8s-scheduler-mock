import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { EtcdStore } from '../store/etcd-store'

export class EtcdActor extends Actor<'idle' | 'writing' | 'reading', string> {
  constructor(id: string, private store: EtcdStore) {
    const fsm = createXStateMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            WRITE_REQUEST: 'writing',
            READ_REQUEST: 'reading',
          },
        },
        writing: { always: 'idle' },
        reading: { always: 'idle' },
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

  protected onTransition(state: 'idle' | 'writing' | 'reading', event: SimEvent): void {
    if (event.type === 'WRITE_REQUEST') {
      const payload = event.payload as { key: string; value: unknown }
      this.store.set(payload.key, payload.value)
    }
  }
}
