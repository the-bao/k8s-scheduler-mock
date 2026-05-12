import { describe, it, expect, beforeEach } from 'vitest'
import { CNIActor } from '../cni-actor'
import type { SimEvent } from '../../fsm/types'

function sendEvent(actor: CNIActor, event: SimEvent): void {
  actor.receive(event)
}

describe('CNIActor', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const actor = new CNIActor('cni-1')
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('CNI_SETUP transition', () => {
    it('auto-returns to idle after processing', () => {
      const actor = new CNIActor('cni-1')
      sendEvent(actor, { type: 'CNI_SETUP', payload: { pod: 'pod-1' } })
      expect(actor.getState()).toBe('idle')
    })
  })
})