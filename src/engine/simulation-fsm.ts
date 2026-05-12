// src/engine/simulation-fsm.ts
//
// NEW FSM-driven Simulation class.
// Wires all layers: MessageBus, EventHistory, PlaybackController,
// ActorRegistry, EtcdStore, ReactiveStore, TickClock, and all actors.

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
import type { SimulationStatus, SimMessage, PluginConfig, Scenario, OperatorConfig, SimNode } from '../types/simulation'
import { getDefaultNodes, getDefaultResources } from './simulation'

export { getDefaultNodes, getDefaultResources }

export class Simulation {
  readonly bus: MessageBus
  readonly history: EventHistory
  readonly playback: PlaybackController
  readonly clock: TickClock
  readonly registry: ActorRegistry
  readonly store: EtcdStore
  readonly reactiveStore: ReactiveStore

  private status: SimulationStatus = 'idle'
  private messages: SimMessage[] = []
  private nodes: SimNode[] = []
  private plugins: PluginConfig[] = []
  private operators: OperatorConfig[] = []

  constructor(nodeNames: string[] = ['node-1', 'node-2']) {
    this.bus = new MessageBus()
    this.history = new EventHistory()
    this.playback = new PlaybackController()
    this.clock = new TickClock()
    this.store = new EtcdStore()
    this.reactiveStore = new ReactiveStore()
    this.registry = new ActorRegistry()

    // Wire MessageBus to record events
    const originalPublish = this.bus.publish.bind(this.bus)
    this.bus.publish = (event: SimEvent) => {
      originalPublish(event)
      this.history.record(event)
      this.reactiveStore.appendEvent(event)
    }

    // Register all actors
    this.registry.register(new EtcdActor('etcd', this.store))
    this.registry.register(new APIServerActor('api-server', this.store))
    this.registry.register(new SchedulerActor('scheduler', this.reactiveStore))
    this.registry.register(new ControllerManagerActor('controller-manager'))
    this.registry.register(new CRIActor())
    this.registry.register(new CNIActor())
    this.registry.register(new CSIActor())

    for (const nodeName of nodeNames) {
      this.registry.register(new KubeletActor(`kubelet:${nodeName}`, this.reactiveStore))
    }

    this.nodes = getDefaultNodes()
  }

  start(_podSpec: Record<string, unknown>, _scenario?: Scenario): void {
    this.messages = []
    this.status = 'running'
    this.playback.play()
  }

  startSimulation(podSpec: Record<string, unknown>, scenario?: Scenario): void {
    this.start(podSpec, scenario)
  }

  loadBuiltinOperators(): void {
    // Built-in operators loaded via controller-manager
  }

  addPlugin(plugin: PluginConfig): void {
    this.plugins = [...this.plugins, plugin]
    this.nodes = [...this.nodes, { id: plugin.metadata.name, type: 'plugin' as const, component: plugin.metadata.name, label: plugin.metadata.name, state: 'idle' as const }]
  }

  removePlugin(name: string): void {
    this.plugins = this.plugins.filter((p) => p.metadata.name !== name)
    this.nodes = this.nodes.filter((n) => n.id !== name)
  }

  addOperator(operator: OperatorConfig): void {
    this.operators = [...this.operators, operator]
    this.nodes = [...this.nodes, { id: operator.metadata.name, type: 'plugin' as const, component: operator.metadata.name, label: operator.metadata.name, state: 'idle' as const }]
  }

  removeOperator(name: string): void {
    this.operators = this.operators.filter((o) => o.metadata.name !== name)
    this.nodes = this.nodes.filter((n) => n.id !== name)
  }

  play(): void { this.playback.play(); this.status = 'running' }
  pause(): void { this.playback.pause(); this.status = 'paused' }
  stepForward(): void { this.playback.stepForward(); this.status = 'paused' }
  stepBackward(): void { this.playback.stepBackward() }
  jumpTo(index: number): void { this.playback.jumpTo(index) }

  reset(): void {
    this.playback.reset()
    this.history.clear()
    this.reactiveStore.clear()
    this.status = 'idle'
    this.messages = []
    this.nodes = getDefaultNodes()
  }

  setSpeed(speed: number): void { this.playback.setSpeed(speed); this.clock.setSpeed(speed) }
  getState(): SimulationStatus { return this.status }
  getStatus(): SimulationStatus { return this.status }
  getMessages(): SimMessage[] { return this.messages }
  getCurrentIndex(): number { return this.playback.getCurrentIndex() }
  getNodes(): SimNode[] { return this.nodes }
  getSpeed(): number { return this.playback.getSpeed() }
  getResources() { return getDefaultResources() }
  getPlugins(): PluginConfig[] { return this.plugins }
  getOperators(): OperatorConfig[] { return this.operators }
}
