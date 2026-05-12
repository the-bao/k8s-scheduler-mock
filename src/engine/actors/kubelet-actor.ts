import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { ReactiveStore } from '../store/reactive-store'
import type { PodObject } from '../../types/simulation'

type KubeletState =
  | 'idle'
  | 'creating_sandbox'
  | 'settingup_network'
  | 'mounting_volumes'
  | 'pulling_image'
  | 'starting_container'
  | 'running'
  | 'restarting'
  | 'terminating'
  | 'error'

interface KubeletContext extends ActorContext {
  pendingPod: PodObject | null
  errorBackoffUntil: number
}

export class KubeletActor extends Actor<KubeletState, string> {
  private context: KubeletContext = {
    actorId: '',
    bus: { publish: () => {}, route: () => {} },
    store: null as unknown as ReactiveStore,
    pendingPod: null,
    errorBackoffUntil: 0,
  }

  constructor(id: string, private store: ReactiveStore) {
    const fsm = createXStateMachine<KubeletState>({
      initial: 'idle',
      states: {
        idle: {
          on: { POD_BOUND: 'creating_sandbox' },
        },
        creating_sandbox: {
          on: { SANDBOX_OK: 'settingup_network', SANDBOX_FAIL: 'error' },
        },
        settingup_network: {
          on: { CNI_OK: 'mounting_volumes', CNI_FAIL: 'error' },
        },
        mounting_volumes: {
          on: { CSI_OK: 'pulling_image', CSI_FAIL: 'error' },
        },
        pulling_image: {
          on: { PULL_OK: 'starting_container', PULL_FAIL: 'error' },
        },
        starting_container: {
          on: { START_OK: 'running', START_FAIL: 'error' },
        },
        running: {
          on: {
            PROBE_FAIL: 'restarting',
            POD_DELETED: 'terminating',
            TICK: 'running',
          },
        },
        restarting: {
          on: { TICK: 'running' },
        },
        terminating: {
          always: 'idle',
        },
        error: {
          on: { TICK: 'idle' },
        },
      },
    })
    super(id, fsm)
    this.context.store = store
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
      store: this.store,
    }
  }

  protected onTransition(state: KubeletState, event: SimEvent): void {
    switch (state) {
      case 'idle':
        this.handleIdle(event)
        break
      case 'creating_sandbox':
        this.handleCreatingSandbox(event)
        break
      case 'settingup_network':
        this.handleSettingUpNetwork(event)
        break
      case 'mounting_volumes':
        this.handleMountingVolumes(event)
        break
      case 'pulling_image':
        this.handlePullingImage(event)
        break
      case 'starting_container':
        this.handleStartingContainer(event)
        break
      case 'running':
        this.handleRunning(event)
        break
      case 'restarting':
        this.handleRestarting(event)
        break
      case 'terminating':
        this.handleTerminating(event)
        break
      case 'error':
        this.handleError(event)
        break
    }
  }

  private handleIdle(event: SimEvent): void {
    if (event.type === 'POD_BOUND') {
      const payload = event.payload as { pod: PodObject }
      this.context.pendingPod = payload.pod
    }
  }

  private handleCreatingSandbox(_event: SimEvent): void {
    // Sandbox creation happens automatically, transitions on SANDBOX_OK/SANDBOX_FAIL
  }

  private handleSettingUpNetwork(_event: SimEvent): void {
    // Network setup happens automatically, transitions on CNI_OK/CNI_FAIL
  }

  private handleMountingVolumes(_event: SimEvent): void {
    // Volume mounting happens automatically, transitions on CSI_OK/CSI_FAIL
  }

  private handlePullingImage(_event: SimEvent): void {
    // Image pulling happens automatically, transitions on PULL_OK/PULL_FAIL
  }

  private handleStartingContainer(_event: SimEvent): void {
    // Container start happens automatically, transitions on START_OK/START_FAIL
  }

  private handleRunning(event: SimEvent): void {
    if (event.type === 'POD_DELETED') {
      this.context.pendingPod = null
    }
  }

  private handleRestarting(_event: SimEvent): void {
    // Restart logic handled on TICK transition
  }

  private handleTerminating(_event: SimEvent): void {
    // Terminating cleanup handled
  }

  private handleError(event: SimEvent): void {
    if (event.type === 'TICK') {
      // Check if backoff elapsed
      if (Date.now() >= this.context.errorBackoffUntil) {
        this.context.pendingPod = null
      }
    }
  }
}