import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'

export type CRIState = 'idle' | 'processing'

export class CRIActor extends Actor<'idle' | 'processing', string> {
  constructor(id: string = 'cri') {
    const fsm = createXStateMachine<CRIState>({
      initial: 'idle',
      states: {
        idle: {
          on: {
            CREATE_SANDBOX: 'processing',
            PULL_IMAGE: 'processing',
            START_CONTAINER: 'processing',
          },
        },
        processing: { always: 'idle' },
      },
    })
    super(id, fsm)
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
    }
  }

  protected onTransition(_state: 'idle' | 'processing', _event: SimEvent): void {
    // CRI operations are processed
  }
}