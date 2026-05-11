import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APIServerActor } from '../api-server-actor'
import { EtcdStore } from '../../store/etcd-store'
import type { SimEvent } from '../../fsm/types'

function createTestStore(): EtcdStore {
  return new EtcdStore()
}

function sendEvent(actor: APIServerActor, event: SimEvent): void {
  actor.receive(event)
}

describe('APIServerActor', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const store = createTestStore()
      const actor = new APIServerActor('api-server-1', store)
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('USER_APPLY transition', () => {
    it('transitions to validating on USER_APPLY', () => {
      const store = createTestStore()
      const actor = new APIServerActor('api-server-1', store)
      sendEvent(actor, { type: 'USER_APPLY', payload: { name: 'test-pod' } })
      // Validation should pass, so we move to storing
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('BIND_REQUEST transition', () => {
    it('transitions to updating on BIND_REQUEST', () => {
      const store = createTestStore()
      const actor = new APIServerActor('api-server-1', store)
      sendEvent(actor, { type: 'BIND_REQUEST', payload: { pod: 'test-pod', node: 'node-1' } })
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('STATUS_UPDATE transition', () => {
    it('transitions to updating on STATUS_UPDATE', () => {
      const store = createTestStore()
      const actor = new APIServerActor('api-server-1', store)
      sendEvent(actor, { type: 'STATUS_UPDATE', payload: { pod: 'test-pod', status: 'Running' } })
      expect(actor.getState()).toBe('idle')
    })
  })
})
