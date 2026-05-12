import { describe, it, expect, beforeEach } from 'vitest'
import { KubeletActor } from '../kubelet-actor'
import { ReactiveStore } from '../../store/reactive-store'
import type { SimEvent } from '../../fsm/types'
import type { PodObject } from '../../../types/simulation'

function createTestStore(): ReactiveStore {
  return new ReactiveStore()
}

function sendEvent(actor: KubeletActor, event: SimEvent): void {
  actor.receive(event)
}

describe('KubeletActor', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('POD_BOUND transition', () => {
    it('transitions to creating_sandbox on POD_BOUND', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }
      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      expect(actor.getState()).toBe('creating_sandbox')
    })
  })

  describe('happy path transitions', () => {
    it('transitions through sandbox->network->volumes->image->container->running', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      // idle -> creating_sandbox
      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      expect(actor.getState()).toBe('creating_sandbox')

      // creating_sandbox -> settingup_network
      sendEvent(actor, { type: 'SANDBOX_OK' })
      expect(actor.getState()).toBe('settingup_network')

      // settingup_network -> mounting_volumes
      sendEvent(actor, { type: 'CNI_OK' })
      expect(actor.getState()).toBe('mounting_volumes')

      // mounting_volumes -> pulling_image
      sendEvent(actor, { type: 'CSI_OK' })
      expect(actor.getState()).toBe('pulling_image')

      // pulling_image -> starting_container
      sendEvent(actor, { type: 'PULL_OK' })
      expect(actor.getState()).toBe('starting_container')

      // starting_container -> running
      sendEvent(actor, { type: 'START_OK' })
      expect(actor.getState()).toBe('running')
    })
  })

  describe('error transitions', () => {
    it('transitions to error on SANDBOX_FAIL', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      expect(actor.getState()).toBe('creating_sandbox')

      sendEvent(actor, { type: 'SANDBOX_FAIL' })
      expect(actor.getState()).toBe('error')
    })

    it('transitions to error on CNI_FAIL', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_OK' })
      expect(actor.getState()).toBe('settingup_network')

      sendEvent(actor, { type: 'CNI_FAIL' })
      expect(actor.getState()).toBe('error')
    })

    it('transitions to error on CSI_FAIL', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_OK' })
      sendEvent(actor, { type: 'CNI_OK' })
      expect(actor.getState()).toBe('mounting_volumes')

      sendEvent(actor, { type: 'CSI_FAIL' })
      expect(actor.getState()).toBe('error')
    })

    it('transitions to error on PULL_FAIL', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_OK' })
      sendEvent(actor, { type: 'CNI_OK' })
      sendEvent(actor, { type: 'CSI_OK' })
      expect(actor.getState()).toBe('pulling_image')

      sendEvent(actor, { type: 'PULL_FAIL' })
      expect(actor.getState()).toBe('error')
    })

    it('transitions to error on START_FAIL', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_OK' })
      sendEvent(actor, { type: 'CNI_OK' })
      sendEvent(actor, { type: 'CSI_OK' })
      sendEvent(actor, { type: 'PULL_OK' })
      expect(actor.getState()).toBe('starting_container')

      sendEvent(actor, { type: 'START_FAIL' })
      expect(actor.getState()).toBe('error')
    })
  })

  describe('error recovery', () => {
    it('returns to idle from error on TICK', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      // Get to error state
      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_FAIL' })
      expect(actor.getState()).toBe('error')

      // TICK should transition back to idle
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('running state transitions', () => {
    it('stays in running on TICK (healthy)', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      // Get to running state
      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_OK' })
      sendEvent(actor, { type: 'CNI_OK' })
      sendEvent(actor, { type: 'CSI_OK' })
      sendEvent(actor, { type: 'PULL_OK' })
      sendEvent(actor, { type: 'START_OK' })
      expect(actor.getState()).toBe('running')

      // TICK should keep it in running (healthy probe)
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('running')
    })

    it('transitions to terminating on POD_DELETED and immediately goes to idle', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      // Get to running state
      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_OK' })
      sendEvent(actor, { type: 'CNI_OK' })
      sendEvent(actor, { type: 'CSI_OK' })
      sendEvent(actor, { type: 'PULL_OK' })
      sendEvent(actor, { type: 'START_OK' })
      expect(actor.getState()).toBe('running')

      // POD_DELETED transitions to terminating, which immediately auto-transitions to idle
      sendEvent(actor, { type: 'POD_DELETED' })
      // terminating has 'always' transition which fires immediately
      expect(actor.getState()).toBe('idle')
    })

    it('terminating always transitions to idle', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      // Get to running state
      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_OK' })
      sendEvent(actor, { type: 'CNI_OK' })
      sendEvent(actor, { type: 'CSI_OK' })
      sendEvent(actor, { type: 'PULL_OK' })
      sendEvent(actor, { type: 'START_OK' })
      expect(actor.getState()).toBe('running')

      // POD_DELETED transitions to terminating, which immediately auto-transitions to idle
      // (xstate 'always' transitions fire immediately)
      sendEvent(actor, { type: 'POD_DELETED' })
      expect(actor.getState()).toBe('idle')

      // TICK in idle state stays in idle
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('restarting state', () => {
    it('transitions to running from restarting on TICK', () => {
      const store = createTestStore()
      const actor = new KubeletActor('kubelet:node-1', store)
      const pod: PodObject = {
        name: 'test-pod',
        namespace: 'default',
        nodeName: 'node-1',
        phase: 'Pending',
        conditions: [],
        spec: { containers: [], resources: {} },
      }

      // Get to running state first
      sendEvent(actor, { type: 'POD_BOUND', payload: { pod } })
      sendEvent(actor, { type: 'SANDBOX_OK' })
      sendEvent(actor, { type: 'CNI_OK' })
      sendEvent(actor, { type: 'CSI_OK' })
      sendEvent(actor, { type: 'PULL_OK' })
      sendEvent(actor, { type: 'START_OK' })
      expect(actor.getState()).toBe('running')

      // PROBE_FAIL transitions to restarting
      sendEvent(actor, { type: 'PROBE_FAIL' })
      expect(actor.getState()).toBe('restarting')

      // TICK transitions back to running
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('running')
    })
  })
})