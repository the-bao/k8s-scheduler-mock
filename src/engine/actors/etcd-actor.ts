import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { EtcdStore } from '../store/etcd-store'
import type { MessageBus } from '../bus/message-bus'

export class EtcdActor extends Actor<'idle' | 'writing' | 'reading', string> {
  private store: EtcdStore

  constructor(id: string, store: EtcdStore) {
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
    this.store = store
  }

  subscribe(bus: MessageBus, _channel: string): void {
    bus.subscribe('etcd', (e) => this.receive(e))
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
      store: this.store,
    }
  }

  protected onTransition(_state: 'idle' | 'writing' | 'reading', event: SimEvent): void {
    if (event.type === 'WRITE_REQUEST') {
      const payload = event.payload as { key: string; value: unknown }
      this.store.set(payload.key, payload.value)
    }
  }
}
