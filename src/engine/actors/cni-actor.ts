import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { MessageBus } from '../bus/message-bus'

export type CNIState = 'idle' | 'processing'

export class CNIActor extends Actor<'idle' | 'processing', string> {
  constructor(id: string = 'cni') {
    const fsm = createXStateMachine<CNIState>({
      initial: 'idle',
      states: {
        idle: {
          on: { CNI_SETUP: 'processing' },
        },
        processing: { always: 'idle' },
      },
    })
    super(id, fsm)
  }

  subscribe(bus: MessageBus, _channel: string): void {
    bus.subscribe('cni', (e) => this.receive(e))
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
    }
  }

  protected onTransition(_state: 'idle' | 'processing', _event: SimEvent): void {
    // CNI operations are processed
  }
}