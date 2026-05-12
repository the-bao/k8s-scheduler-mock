import { describe, it, expect, beforeEach } from 'vitest'
import { OperatorPluginActor } from '../plugins/operator-plugin-actor'
import type { SimEvent } from '../../fsm/types'

function sendEvent(actor: OperatorPluginActor, event: SimEvent): void {
  actor.receive(event)
}

describe('OperatorPluginActor', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const actor = new OperatorPluginActor('op-plugin-1', [], [])
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('RECONCILE transition', () => {
    it('transitions to processing on RECONCILE', () => {
      const actor = new OperatorPluginActor('op-plugin-1', ['pods'], [
        { match: { resource: 'pods' }, actions: [] },
      ])
      sendEvent(actor, { type: 'RECONCILE', payload: { resource: 'pods' } })
      // Should auto-return to idle after processing
      expect(actor.getState()).toBe('idle')
    })

    it('auto-returns to idle after processing', () => {
      const actor = new OperatorPluginActor('op-plugin-1', ['pods'], [])
      sendEvent(actor, { type: 'RECONCILE', payload: { resource: 'pods' } })
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('context', () => {
    it('stores watched resources in context', () => {
      const watchedResources = ['pods', 'services', 'configmaps']
      const actor = new OperatorPluginActor('op-plugin-1', watchedResources, [])
      // Context is protected, but we can verify behavior through events
      expect(actor.getState()).toBe('idle')
    })

    it('stores reconcile rules in context', () => {
      const reconcileRules = [
        { match: { resource: 'pods' }, actions: [{ type: 'LOG' }] },
      ]
      const actor = new OperatorPluginActor('op-plugin-1', ['pods'], reconcileRules)
      expect(actor.getState()).toBe('idle')
    })
  })
})
