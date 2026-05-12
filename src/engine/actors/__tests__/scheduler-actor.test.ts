import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SchedulerActor } from '../scheduler-actor'
import { ReactiveStore } from '../../store/reactive-store'
import type { SimEvent } from '../../fsm/types'
import type { PodObject, NodeObject } from '../../../types/simulation'

function createTestStore(): ReactiveStore {
  return new ReactiveStore()
}

function sendEvent(actor: SchedulerActor, event: SimEvent): void {
  actor.receive(event)
}

describe('SchedulerActor', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const store = createTestStore()
      const actor = new SchedulerActor('scheduler-1', store)
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('POD_PENDING transition', () => {
    it('transitions to filtering on POD_PENDING', () => {
      const store = createTestStore()
      const actor = new SchedulerActor('scheduler-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: null,
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }
      sendEvent(actor, { type: 'POD_PENDING', payload: { pod } })
      expect(actor.getState()).toBe('filtering')
    })
  })

  describe('state transitions', () => {
    it('transitions to scoring from filtering', () => {
      const store = createTestStore()
      const actor = new SchedulerActor('scheduler-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: null,
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }
      const nodes: NodeObject[] = [
        { name: 'node-1', labels: {}, allocatable: { cpu: 4, memory: 8192 } },
      ]
      sendEvent(actor, { type: 'POD_PENDING', payload: { pod, nodes } })
      expect(actor.getState()).toBe('filtering')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('scoring')
    })

    it('transitions to binding from scoring', () => {
      const store = createTestStore()
      const actor = new SchedulerActor('scheduler-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: null,
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }
      const nodes: NodeObject[] = [
        { name: 'node-1', labels: {}, allocatable: { cpu: 4, memory: 8192 } },
      ]
      sendEvent(actor, { type: 'POD_PENDING', payload: { pod, nodes } })
      expect(actor.getState()).toBe('filtering')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('scoring')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('binding')
    })

    it('returns to idle on BIND_OK', () => {
      const store = createTestStore()
      const actor = new SchedulerActor('scheduler-1', store)
      sendEvent(actor, { type: 'BIND_OK' })
      expect(actor.getState()).toBe('idle')
    })

    it('returns to idle on BIND_FAIL', () => {
      const store = createTestStore()
      const actor = new SchedulerActor('scheduler-1', store)
      sendEvent(actor, { type: 'BIND_FAIL' })
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('backoff requeue', () => {
    it('transitions to error state on FILTER_ERROR', () => {
      const store = createTestStore()
      const actor = new SchedulerActor('scheduler-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: null,
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }
      const nodes: NodeObject[] = [
        { name: 'node-1', labels: {}, allocatable: { cpu: 4, memory: 8192 } },
      ]
      // First transition to filtering via POD_PENDING
      sendEvent(actor, { type: 'POD_PENDING', payload: { pod, nodes } })
      // Then send FILTER_ERROR to transition from filtering to error
      sendEvent(actor, { type: 'FILTER_ERROR', payload: { pod } })
      expect(actor.getState()).toBe('error')
    })

    it('returns to idle from error on TICK (backoff elapsed)', () => {
      const store = createTestStore()
      const actor = new SchedulerActor('scheduler-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: null,
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }
      const nodes: NodeObject[] = [
        { name: 'node-1', labels: {}, allocatable: { cpu: 4, memory: 8192 } },
      ]
      // First transition to filtering via POD_PENDING
      sendEvent(actor, { type: 'POD_PENDING', payload: { pod, nodes } })
      // Then send FILTER_ERROR to transition from filtering to error
      sendEvent(actor, { type: 'FILTER_ERROR', payload: { pod } })
      expect(actor.getState()).toBe('error')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('idle')
    })
  })
})
