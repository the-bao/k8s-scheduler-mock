import { describe, it, expect, vi } from 'vitest'
import { ReactiveStore } from '../reactive-store'
import type { SimEvent } from '../../fsm/types'
import type { PodObject } from '../../types/simulation'

describe('ReactiveStore', () => {
  it('starts with empty cluster state', () => {
    const store = new ReactiveStore()
    const snapshot = store.getSnapshot()
    expect(snapshot.actors).toEqual({})
    expect(snapshot.pods).toEqual({})
    expect(snapshot.nodes).toEqual({})
    expect(snapshot.events).toEqual([])
  })

  it('updates actor state', () => {
    const store = new ReactiveStore()
    store.updateActorState('scheduler', 'idle')

    const snapshot = store.getSnapshot()
    expect(snapshot.actors['scheduler']).toEqual({
      state: 'idle',
      updatedAt: expect.any(Number),
    })
  })

  it('updates pod', () => {
    const store = new ReactiveStore()
    const pod: PodObject = {
      name: 'test-pod',
      namespace: 'default',
      nodeName: null,
      phase: 'Pending',
      conditions: [],
      spec: { containers: [], resources: {} },
    }
    store.updatePod('default/test-pod', pod)

    const snapshot = store.getSnapshot()
    expect(snapshot.pods['default/test-pod']).toBe(pod)
  })

  it('appends events to log', () => {
    const store = new ReactiveStore()
    const event: SimEvent = { type: 'test-event', from: 'a', to: 'b' }
    store.appendEvent(event)

    const snapshot = store.getSnapshot()
    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.events[0]).toBe(event)
  })

  it('subscribe returns unsubscribe function', () => {
    const store = new ReactiveStore()
    const handler = vi.fn()

    const unsubscribe = store.subscribe(handler)
    expect(typeof unsubscribe).toBe('function')

    // trigger update
    store.updateActorState('actor1', 'active')
    expect(handler).toHaveBeenCalledTimes(1)

    // unsubscribe
    unsubscribe()

    // trigger another update
    store.updateActorState('actor2', 'active')
    expect(handler).toHaveBeenCalledTimes(1) // should NOT have been called again
  })

  it('notifies subscribers on any state change', () => {
    const store = new ReactiveStore()
    const handler = vi.fn()
    store.subscribe(handler)

    store.updateActorState('actor1', 'active')
    expect(handler).toHaveBeenCalledTimes(1)

    store.updatePod('default/test-pod', {
      name: 'test-pod',
      namespace: 'default',
      nodeName: null,
      phase: 'Pending',
      conditions: [],
      spec: { containers: [], resources: {} },
    })
    expect(handler).toHaveBeenCalledTimes(2)

    store.appendEvent({ type: 'event1' })
    expect(handler).toHaveBeenCalledTimes(3)
  })
})