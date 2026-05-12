import { Actor } from '../fsm/actor'
import { createXStateMachine } from '../fsm/xstate-adapter'
import type { ActorContext, SimEvent } from '../fsm/types'
import type { ReactiveStore } from '../store/reactive-store'
import type { PodObject, NodeObject } from '../../types/simulation'
import type { MessageBus } from '../bus/message-bus'

type SchedState = 'idle' | 'filtering' | 'scoring' | 'binding' | 'error'

interface SchedulerContext extends ActorContext {
  pendingPod: PodObject | null
  candidates: NodeObject[]
  scores: Map<string, number>
  errorBackoffUntil: number
}

export class SchedulerActor extends Actor<SchedState, string> {
  private context: SchedulerContext = {
    actorId: '',
    bus: { publish: () => {}, route: () => {} },
    store: null as unknown as ReactiveStore,
    pendingPod: null,
    candidates: [],
    scores: new Map(),
    errorBackoffUntil: 0,
  }

  constructor(id: string, store: ReactiveStore) {
    const fsm = createXStateMachine<SchedState>({
      initial: 'idle',
      states: {
        idle: {
          on: { POD_PENDING: 'filtering' },
        },
        filtering: {
          on: {
            FILTER_ERROR: 'error',
            TICK: 'scoring',
          },
        },
        scoring: {
          on: {
            TICK: 'binding',
          },
        },
        binding: {
          on: { BIND_OK: 'idle', BIND_FAIL: 'idle', TICK: 'binding' },
        },
        error: {
          on: { TICK: 'idle' },
        },
      },
    })
    super(id, fsm)
    this.context.store = store
  }

  subscribe(bus: MessageBus, _channel: string): void {
    bus.subscribe('scheduler', (e) => this.receive(e))
    bus.subscribe('POD_PENDING', (e) => this.receive(e))
  }

  protected makeCtx(): ActorContext {
    return {
      actorId: this.id,
      bus: { publish: () => {}, route: () => {} },
      store: this.context.store,
    }
  }

  protected onTransition(state: SchedState, event: SimEvent): void {
    switch (state) {
      case 'idle':
        this.handleIdle(event)
        break
      case 'filtering':
        this.handleFiltering(event)
        break
      case 'scoring':
        this.handleScoring(event)
        break
      case 'binding':
        this.handleBinding(event)
        break
      case 'error':
        this.handleError(event)
        break
    }
  }

  private handleIdle(event: SimEvent): void {
    if (event.type === 'POD_PENDING') {
      const payload = event.payload as { pod: PodObject; nodes?: NodeObject[] }
      this.context.pendingPod = payload.pod
      this.context.candidates = payload.nodes ?? []
      this.context.scores.clear()
    }
  }

  private handleFiltering(_event: SimEvent): void {
    // Auto-transition guard: if candidates > 0 go to scoring, else idle
    // The actual filtering logic would happen here in a real implementation
    // For now, auto-transition to scoring (filter passes all candidates)
    if (this.context.candidates.length === 0) {
      this.publishUnschedulable()
    }
  }

  private handleScoring(_event: SimEvent): void {
    // Auto-transition guard: if best score > 0 go to binding, else idle
    // Auto-transition to binding (score passes - in real impl, would check scores)
    if (this.context.scores.size === 0) {
      this.publishUnschedulable()
    }
  }

  private handleBinding(event: SimEvent): void {
    if (event.type === 'BIND_OK') {
      this.context.pendingPod = null
      this.context.candidates = []
      this.context.scores.clear()
    } else if (event.type === 'BIND_FAIL') {
      // Requeue: publish POD_PENDING to self
      if (this.context.pendingPod) {
        this.context.errorBackoffUntil = Date.now() + 5000 // 5s backoff
        this.scheduleRequeue()
      }
    }
  }

  private handleError(event: SimEvent): void {
    if (event.type === 'TICK') {
      // Check if backoff elapsed
      if (Date.now() >= this.context.errorBackoffUntil) {
        this.context.pendingPod = null
        this.context.candidates = []
        this.context.scores.clear()
      }
    }
  }

  private publishUnschedulable(): void {
    if (this.context.pendingPod) {
      const ctx = this.makeCtx()
      ctx.bus.publish({
        type: 'POD_UNSCHEDULABLE',
        from: this.id,
        payload: { pod: this.context.pendingPod },
      })
    }
  }

  private scheduleRequeue(): void {
    // In real implementation, would schedule a TICK event after backoff
    // For now, the error state handles this on next TICK
  }
}
