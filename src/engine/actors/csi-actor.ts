import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { MessageBus } from '../bus/message-bus'

export type CSIState = 'idle' | 'processing'

export class CSIActor extends Actor<'idle' | 'processing', string> {
  constructor(id: string = 'csi') {
    const fsm = createXStateMachine<CSIState>({
      initial: 'idle',
      states: {
        idle: {
          on: {
            CSI_STAGE_VOLUME: 'processing',
            CSI_PUBLISH_VOLUME: 'processing',
          },
        },
        processing: { always: 'idle' },
      },
    })
    super(id, fsm)
  }

  subscribe(bus: MessageBus, _channel: string): void {
    bus.subscribe('csi', (e) => this.receive(e))
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
    }
  }

  protected onTransition(_state: 'idle' | 'processing', _event: SimEvent): void {
    // CSI operations are processed
  }
}