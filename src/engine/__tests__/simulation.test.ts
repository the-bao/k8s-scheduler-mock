import { Simulation } from '../simulation'
import { MessageBus } from '../bus/message-bus'
import { EventHistory } from '../bus/event-history'
import { PlaybackController } from '../bus/playback-controller'
import { EtcdStore } from '../store/etcd-store'
import { ReactiveStore } from '../store/reactive-store'
import { ActorRegistry } from '../fsm/registry'

describe('Simulation', () => {
  it('creates all layers', () => {
    const sim = new Simulation()
    expect(sim.bus).toBeInstanceOf(MessageBus)
    expect(sim.history).toBeInstanceOf(EventHistory)
    expect(sim.playback).toBeInstanceOf(PlaybackController)
    expect(sim.store).toBeInstanceOf(EtcdStore)
    expect(sim.reactiveStore).toBeInstanceOf(ReactiveStore)
    expect(sim.registry).toBeInstanceOf(ActorRegistry)
  })

  it('registers all actors', () => {
    const sim = new Simulation()
    expect(sim.registry.lookup('etcd')).toBeDefined()
    expect(sim.registry.lookup('api-server')).toBeDefined()
    expect(sim.registry.lookup('scheduler')).toBeDefined()
    expect(sim.registry.lookup('controller-manager')).toBeDefined()
    expect(sim.registry.lookup('cri')).toBeDefined()
    expect(sim.registry.lookup('cni')).toBeDefined()
    expect(sim.registry.lookup('csi')).toBeDefined()
    expect(sim.registry.lookup('kubelet:node-1')).toBeDefined()
    expect(sim.registry.lookup('kubelet:node-2')).toBeDefined()
  })

  it('starts in idle state', () => {
    const sim = new Simulation()
    expect(sim.getState()).toBe('idle')
  })

  it('has control methods', () => {
    const sim = new Simulation()
    expect(typeof sim.play).toBe('function')
    expect(typeof sim.pause).toBe('function')
    expect(typeof sim.stepForward).toBe('function')
    expect(typeof sim.reset).toBe('function')
    expect(typeof sim.setSpeed).toBe('function')
  })

  it('wires bus.publish to history and reactiveStore', () => {
    const sim = new Simulation()
    const initialHistoryLength = sim.history.getAll().length
    const initialEventsLength = sim.reactiveStore.getSnapshot().events.length

    // Publish an event through the bus
    sim.bus.publish({
      type: 'TEST_EVENT',
      from: 'test',
      timestamp: 0,
      phase: 'test',
      payload: {},
    })

    // History should record it
    expect(sim.history.getAll().length).toBe(initialHistoryLength + 1)
    // ReactiveStore should record it
    expect(sim.reactiveStore.getSnapshot().events.length).toBe(initialEventsLength + 1)
  })

  it('creates kubelet actors for each node name', () => {
    const sim = new Simulation(['node-a', 'node-b', 'node-c'])
    expect(sim.registry.lookup('kubelet:node-a')).toBeDefined()
    expect(sim.registry.lookup('kubelet:node-b')).toBeDefined()
    expect(sim.registry.lookup('kubelet:node-c')).toBeDefined()
    expect(sim.registry.lookup('kubelet:node-1')).toBeUndefined()
  })
})
