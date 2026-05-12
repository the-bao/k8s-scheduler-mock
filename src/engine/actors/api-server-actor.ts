import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { EtcdStore } from '../store/etcd-store'
import type { MessageBus } from '../bus/message-bus'

export class APIServerActor extends Actor<'idle' | 'validating' | 'storing' | 'broadcasting' | 'updating', string> {
  private ctx: ActorContext = { actorId: '', bus: { publish: () => {}, route: () => {} }, store: null as unknown as EtcdStore }

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
        validating: {
          on: {
            NEXT: 'storing',
          },
        },
        storing: {
          on: {
            NEXT: 'broadcasting',
          },
        },
        broadcasting: {
          on: {
            NEXT: 'idle',
          },
        },
        updating: {
          on: {
            NEXT: 'idle',
          },
        },
      },
    })
    super(id, fsm)
    this.ctx = { actorId: id, bus: { publish: () => {}, route: () => {} }, store }
  }

  subscribe(bus: MessageBus, _channel: string): void {
    bus.subscribe('api-server', (e) => this.receive(e))
    bus.subscribe('USER_APPLY', (e) => this.receive(e))
  }

  protected makeCtx(): ActorContext {
    return this.ctx
  }

  protected onTransition(state: 'idle' | 'validating' | 'storing' | 'broadcasting' | 'updating', event: SimEvent): void {
    console.log(`[APIServer] onTransition: ${event.type}, state: ${state}`)
    // Use setTimeout to avoid recursive drain loop and to allow state machine to process
    if (state === 'validating' && event.type === 'USER_APPLY') {
      setTimeout(() => {
        this.receive({ type: 'NEXT', from: this.id, ts: Date.now() })
        // Also publish WRITE_REQUEST for etcd
        this.bus?.publish({
          type: 'WRITE_REQUEST',
          from: this.id,
          payload: { pod: event.payload },
          ts: Date.now(),
        })
      }, 0)
    } else if (state === 'storing' && event.type === 'NEXT') {
      setTimeout(() => {
        this.receive({ type: 'NEXT', from: this.id, ts: Date.now() })
      }, 0)
    } else if (state === 'broadcasting' && event.type === 'NEXT') {
      setTimeout(() => {
        this.receive({ type: 'NEXT', from: this.id, ts: Date.now() })
        // Broadcast POD_CREATED for controller/scheduler
        this.bus?.publish({
          type: 'POD_CREATED',
          from: this.id,
          payload: event.payload,
          ts: Date.now(),
        })
      }, 0)
    }
  }
}
