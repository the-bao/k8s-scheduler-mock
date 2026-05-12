import { describe, it, expect, beforeEach } from 'vitest'
import { CSIActor } from '../csi-actor'
import type { SimEvent } from '../../fsm/types'

function sendEvent(actor: CSIActor, event: SimEvent): void {
  actor.receive(event)
}

describe('CSIActor', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const actor = new CSIActor('csi-1')
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('CSI_STAGE_VOLUME transition', () => {
    it('auto-returns to idle after processing', () => {
      const actor = new CSIActor('csi-1')
      sendEvent(actor, { type: 'CSI_STAGE_VOLUME', payload: { volume: 'vol-1' } })
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('CSI_PUBLISH_VOLUME transition', () => {
    it('auto-returns to idle after processing', () => {
      const actor = new CSIActor('csi-1')
      sendEvent(actor, { type: 'CSI_PUBLISH_VOLUME', payload: { volume: 'vol-1' } })
      expect(actor.getState()).toBe('idle')
    })
  })
})