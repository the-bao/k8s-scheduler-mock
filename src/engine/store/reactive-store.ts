import type { SimEvent } from '../fsm/types'
import type { PodObject } from '../../types/simulation'

export interface ClusterState {
  actors: Record<string, { state: string; updatedAt: number }>
  pods: Record<string, PodObject>
  nodes: Record<string, unknown>
  events: SimEvent[]
}

export class ReactiveStore {
  private state: ClusterState = {
    actors: {},
    pods: {},
    nodes: {},
    events: [],
  }

  private subscribers: Set<() => void> = new Set()

  getSnapshot(): ClusterState {
    return this.state
  }

  subscribe(handler: () => void): () => void {
    this.subscribers.add(handler)
    return () => {
      this.subscribers.delete(handler)
    }
  }

  private notify(): void {
    for (const handler of this.subscribers) {
      handler()
    }
  }

  updateActorState(actorId: string, state: string): void {
    this.state = {
      ...this.state,
      actors: {
        ...this.state.actors,
        [actorId]: { state, updatedAt: Date.now() },
      },
    }
    this.notify()
  }

  updatePod(key: string, pod: PodObject): void {
    this.state = {
      ...this.state,
      pods: {
        ...this.state.pods,
        [key]: pod,
      },
    }
    this.notify()
  }

  appendEvent(event: SimEvent): void {
    this.state = {
      ...this.state,
      events: [...this.state.events, event],
    }
    this.notify()
  }

  clear(): void {
    this.state = {
      actors: {},
      pods: {},
      nodes: {},
      events: [],
    }
    this.notify()
  }
}