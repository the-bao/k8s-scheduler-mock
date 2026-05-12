import { describe, it, expect } from 'vitest'
import { ControllerManagerActor } from '../controller-manager-actor'
import type { SimEvent } from '../../fsm/types'

function sendEvent(actor: ControllerManagerActor, event: SimEvent): void {
  actor.receive(event)
}

describe('ControllerManagerActor', () => {
  describe('initial state', () => {
    it('starts in watching state', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      expect(actor.getState()).toBe('watching')
    })
  })

  describe('watching state transitions', () => {
    it('transitions to reconciling on POD_CREATED', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      sendEvent(actor, { type: 'POD_CREATED', payload: { pod: { name: 'test-pod' } } })
      expect(actor.getState()).toBe('reconciling')
    })

    it('transitions to reconciling on POD_UPDATED', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      sendEvent(actor, { type: 'POD_UPDATED', payload: { pod: { name: 'test-pod' } } })
      expect(actor.getState()).toBe('reconciling')
    })

    it('transitions to reconciling on POD_FAILED', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      sendEvent(actor, { type: 'POD_FAILED', payload: { pod: { name: 'test-pod' } } })
      expect(actor.getState()).toBe('reconciling')
    })

    it('transitions to reconciling on CRD_ADDED', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      sendEvent(actor, { type: 'CRD_ADDED', payload: { crd: { name: 'test-crd' } } })
      expect(actor.getState()).toBe('reconciling')
    })
  })

  describe('reconciling state', () => {
    it('auto-transitions to updating on TICK', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      sendEvent(actor, { type: 'POD_CREATED', payload: { pod: { name: 'test-pod' } } })
      expect(actor.getState()).toBe('reconciling')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('updating')
    })
  })

  describe('updating state', () => {
    it('auto-transitions to watching on TICK', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      sendEvent(actor, { type: 'POD_CREATED', payload: { pod: { name: 'test-pod' } } })
      expect(actor.getState()).toBe('reconciling')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('updating')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('watching')
    })

    it('transitions to error on UPDATE_FAIL', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      sendEvent(actor, { type: 'POD_CREATED', payload: { pod: { name: 'test-pod' } } })
      expect(actor.getState()).toBe('reconciling')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('updating')
      sendEvent(actor, { type: 'UPDATE_FAIL', payload: { error: 'update failed' } })
      expect(actor.getState()).toBe('error')
    })
  })

  describe('error state', () => {
    it('returns to watching from error on TICK', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      sendEvent(actor, { type: 'POD_CREATED', payload: { pod: { name: 'test-pod' } } })
      expect(actor.getState()).toBe('reconciling')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('updating')
      sendEvent(actor, { type: 'UPDATE_FAIL', payload: { error: 'update failed' } })
      expect(actor.getState()).toBe('error')
      sendEvent(actor, { type: 'TICK' })
      expect(actor.getState()).toBe('watching')
    })
  })

  describe('managed controllers', () => {
    it('has deployment controller', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      expect(actor.getControllers()).toContain('DeploymentController')
    })

    it('has replicaSet controller', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      expect(actor.getControllers()).toContain('ReplicaSetController')
    })

    it('has daemonSet controller', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      expect(actor.getControllers()).toContain('DaemonSetController')
    })

    it('has job controller', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      expect(actor.getControllers()).toContain('JobController')
    })

    it('has cronJob controller', () => {
      const actor = new ControllerManagerActor('controller-manager-1')
      expect(actor.getControllers()).toContain('CronJobController')
    })
  })
})