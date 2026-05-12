import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { EtcdStore } from '../store/etcd-store'
import type { MessageBus } from '../bus/message-bus'

export class APIServerActor extends Actor<'idle' | 'validating' | 'storing' | 'broadcasting' | 'updating', string> {
  private store: EtcdStore

  constructor(id: string, store: EtcdStore) {
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
    this.store = store
  }

  subscribe(bus: MessageBus, _channel: string): void {
    bus.subscribe('api-server', (e) => this.receive(e))
    bus.subscribe('USER_APPLY', (e) => this.receive(e))
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
      store: this.store,
    }
  }

  protected onTransition(_state: 'idle' | 'validating' | 'storing' | 'broadcasting' | 'updating', _event: SimEvent): void {
    // Handle state transitions
  }
}
