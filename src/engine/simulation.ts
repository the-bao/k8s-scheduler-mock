import { MessageBus } from './bus/message-bus'
import { EventHistory } from './bus/event-history'
import { PlaybackController } from './bus/playback-controller'
import { TickClock } from './trigger/tick-clock'
import { ActorRegistry } from './fsm/registry'
import { EtcdStore } from './store/etcd-store'
import { ReactiveStore } from './store/reactive-store'
import { EtcdActor } from './actors/etcd-actor'
import { APIServerActor } from './actors/api-server-actor'
import { SchedulerActor } from './actors/scheduler-actor'
import { ControllerManagerActor } from './actors/controller-manager-actor'
import { CRIActor } from './actors/cri-actor'
import { CNIActor } from './actors/cni-actor'
import { CSIActor } from './actors/csi-actor'
import { KubeletActor } from './actors/kubelet-actor'
import type { SimEvent } from './fsm/types'

export class Simulation {
  readonly bus: MessageBus
  readonly history: EventHistory
  readonly playback: PlaybackController
  readonly clock: TickClock
  readonly registry: ActorRegistry
  readonly store: EtcdStore
  readonly reactiveStore: ReactiveStore

  constructor(nodeNames: string[] = ['node-1', 'node-2']) {
    // Initialize all layers
    this.bus = new MessageBus()
    this.history = new EventHistory()
    this.playback = new PlaybackController()
    this.clock = new TickClock()
    this.store = new EtcdStore()
    this.reactiveStore = new ReactiveStore()
    this.registry = new ActorRegistry()

    // Wire MessageBus to EventHistory - record all events
    const originalPublish = this.bus.publish.bind(this.bus)
    this.bus.publish = (event: SimEvent) => {
      originalPublish(event)
      this.history.record(event)
      this.reactiveStore.appendEvent(event)
    }

    // Create and register all actors
    this.registry.register(new EtcdActor('etcd', this.store))
    this.registry.register(new APIServerActor('api-server', this.store))
    this.registry.register(new SchedulerActor('scheduler', this.reactiveStore))
    this.registry.register(new ControllerManagerActor('controller-manager'))
    this.registry.register(new CRIActor())
    this.registry.register(new CNIActor())
    this.registry.register(new CSIActor())

    // One KubeletActor per node
    for (const nodeName of nodeNames) {
      this.registry.register(new KubeletActor(`kubelet:${nodeName}`, this.reactiveStore))
    }
  }

  // Control methods
  play(): void {
    this.playback.play()
  }

  pause(): void {
    this.playback.pause()
  }

  stepForward(): void {
    this.playback.stepForward()
  }

  reset(): void {
    this.playback.reset()
  }

  setSpeed(speed: number): void {
    this.playback.setSpeed(speed)
    this.clock.setSpeed(speed)
  }

  getState() {
    return this.playback.getState()
  }
}
