import { describe, it, expect, beforeEach } from 'vitest'
import { CRIActor } from '../cri-actor'
import type { SimEvent } from '../../fsm/types'

function sendEvent(actor: CRIActor, event: SimEvent): void {
  actor.receive(event)
}

describe('CRIActor', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const actor = new CRIActor('cri-1')
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('CREATE_SANDBOX transition', () => {
    it('auto-returns to idle after processing', () => {
      const actor = new CRIActor('cri-1')
      sendEvent(actor, { type: 'CREATE_SANDBOX', payload: { pod: 'pod-1' } })
      // xstate always transitions fire immediately
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('PULL_IMAGE transition', () => {
    it('auto-returns to idle after processing', () => {
      const actor = new CRIActor('cri-1')
      sendEvent(actor, { type: 'PULL_IMAGE', payload: { image: 'nginx:latest' } })
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('START_CONTAINER transition', () => {
    it('auto-returns to idle after processing', () => {
      const actor = new CRIActor('cri-1')
      sendEvent(actor, { type: 'START_CONTAINER', payload: { container: 'nginx' } })
      expect(actor.getState()).toBe('idle')
    })
  })
})