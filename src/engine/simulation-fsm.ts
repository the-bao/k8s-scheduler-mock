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

    // Wire actors to the bus FIRST, before the publish override
    const etcdActor = new EtcdActor('etcd', this.store)
    const apiServerActor = new APIServerActor('api-server', this.store)
    const schedulerActor = new SchedulerActor('scheduler', this.reactiveStore)
    const controllerManagerActor = new ControllerManagerActor('controller-manager')
    const criActor = new CRIActor()
    const cniActor = new CNIActor()
    const csiActor = new CSIActor()

    // Subscribe actors to relevant event types
    etcdActor.subscribe(this.bus, 'etcd')
    apiServerActor.subscribe(this.bus, 'api-server')
    schedulerActor.subscribe(this.bus, 'scheduler')
    controllerManagerActor.subscribe(this.bus, 'controller-manager')
    criActor.subscribe(this.bus, 'cri')
    cniActor.subscribe(this.bus, 'cni')
    csiActor.subscribe(this.bus, 'csi')

    // Register all actors
    this.registry.register(etcdActor)
    this.registry.register(apiServerActor)
    this.registry.register(schedulerActor)
    this.registry.register(controllerManagerActor)
    this.registry.register(criActor)
    this.registry.register(cniActor)
    this.registry.register(csiActor)

    for (const nodeName of nodeNames) {
      const kubeletActor = new KubeletActor(`kubelet:${nodeName}`, this.reactiveStore)
      kubeletActor.subscribe(this.bus, `kubelet:${nodeName}`)
      this.registry.register(kubeletActor)
    }

    // Wire MessageBus to record events (after actors are subscribed)
    // This also converts events to SimMessages for UI display
    const busHandlers = this.bus.handlers
    this.bus.publish = (event: SimEvent) => {
      // Call handlers directly to avoid infinite recursion
      busHandlers.get(event.type)?.forEach(h => h(event))
      if (event.to && event.to !== '*') {
        busHandlers.get(`to:${event.to}`)?.forEach(h => h(event))
      }
      // Record event
      this.history.record(event)
      this.reactiveStore.appendEvent(event)

      // Convert SimEvent to SimMessage for UI
      const msg: SimMessage = {
        id: `msg-${this.messages.length}`,
        from: event.from || '',
        to: event.to || '',
        phase: this.inferPhase(event),
        type: event.type,
        request: event.payload as Record<string, unknown> || {},
        latency: 0,
        timestamp: event.ts || Date.now(),
      }
      this.messages.push(msg)
      // Add to playback controller for stepping
      this.playback.addEvent(event)
    }

    this.nodes = getDefaultNodes()
  }

  private inferPhase(event: SimEvent): import('../types/simulation').Phase {
    const type = event.type
    if (type.startsWith('CREATE') || type.startsWith('WRITE')) return 'submit'
    if (type.startsWith('WATCH') || type === 'POD_CREATED') return 'controller'
    if (type.startsWith('RECONCILE') || type.startsWith('OPERATOR')) return 'operator'
    if (type.startsWith('FILTER') || type.startsWith('SCORE') || type.startsWith('BIND')) return 'scheduling'
    if (type.startsWith('POD_') || type.startsWith('SANDBOX') || type.startsWith('CNI') || type.startsWith('CSI') || type.startsWith('PULL') || type.startsWith('START')) return 'kubelet'
    return 'completed'
  }

  start(podSpec: Record<string, unknown>, scenario?: Scenario): void {
    this.messages = []
    this.status = 'running'
    this.playback.play()

    // Inject the initial USER_APPLY event to trigger the simulation
    const applyEvent: SimEvent = {
      type: 'USER_APPLY',
      from: 'user',
      payload: { pod: podSpec, scenario },
      ts: Date.now(),
    }
    this.bus.publish(applyEvent)
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

  play(): void { console.log('[Sim] play called, this:', this, 'playback:', this?.playback); this.playback.play(); this.status = 'running' }
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
