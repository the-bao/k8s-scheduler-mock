import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'

type CtrlState = 'watching' | 'reconciling' | 'updating' | 'error'

interface ControllerManagerContext extends ActorContext {
  controllers: string[]
}

export class ControllerManagerActor extends Actor<CtrlState, string> {
  private context: ControllerManagerContext = {
    actorId: '',
    bus: { publish: () => {}, route: () => {} },
    store: null as unknown as import('../store/reactive-store').ReactiveStore,
    controllers: [
      'DeploymentController',
      'ReplicaSetController',
      'DaemonSetController',
      'JobController',
      'CronJobController',
    ],
  }

  constructor(id: string) {
    const fsm = createXStateMachine<CtrlState>({
      initial: 'watching',
      states: {
        watching: {
          on: {
            POD_CREATED: 'reconciling',
            POD_UPDATED: 'reconciling',
            POD_FAILED: 'reconciling',
            CRD_ADDED: 'reconciling',
          },
        },
        reconciling: {
          on: {
            TICK: 'updating',
          },
        },
        updating: {
          on: {
            UPDATE_FAIL: 'error',
            TICK: 'watching',
          },
        },
        error: {
          on: { TICK: 'watching' },
        },
      },
    })
    super(id, fsm)
  }

  getControllers(): string[] {
    return [...this.context.controllers]
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
      store: null as unknown as import('../store/reactive-store').ReactiveStore,
    }
  }

  protected onTransition(_state: CtrlState, _event: SimEvent): void {
    // Controller reconciliation logic would go here
    // For now, just handle state transitions
  }
}