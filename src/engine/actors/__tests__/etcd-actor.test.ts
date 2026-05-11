import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EtcdActor } from '../etcd-actor'
import { EtcdStore } from '../../store/etcd-store'
import type { SimEvent } from '../../fsm/types'

function createTestStore(): EtcdStore {
  return new EtcdStore()
}

function sendEvent(actor: EtcdActor, event: SimEvent): void {
  actor.receive(event)
}

describe('EtcdActor', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const store = createTestStore()
      const actor = new EtcdActor('etcd-1', store)
      expect(actor.getState()).toBe('idle')
    })
  })

  describe('WRITE_REQUEST transition', () => {
    it('transitions to writing then auto-transitions back to idle', () => {
      const store = createTestStore()
      const actor = new EtcdActor('etcd-1', store)
      sendEvent(actor, { type: 'WRITE_REQUEST', payload: { key: 'foo', value: 'bar' } })
      // xstate always transitions fire immediately, so we end up back in idle
      expect(actor.getState()).toBe('idle')
    })

    it('writes to etcd store', () => {
      const store = createTestStore()
      const actor = new EtcdActor('etcd-1', store)
      sendEvent(actor, { type: 'WRITE_REQUEST', payload: { key: 'foo', value: 'bar' } })
      expect(actor.getState()).toBe('idle')
      // Verify store was written
      const entry = store.get('foo')
      expect(entry?.value).toBe('bar')
    })
  })

  describe('READ_REQUEST transition', () => {
    it('transitions to reading then auto-transitions back to idle', () => {
      const store = createTestStore()
      const actor = new EtcdActor('etcd-1', store)
      sendEvent(actor, { type: 'READ_REQUEST', payload: { key: 'foo' } })
      expect(actor.getState()).toBe('idle')
    })

    it('reads from etcd store', () => {
      const store = createTestStore()
      store.set('foo', 'bar')
      const actor = new EtcdActor('etcd-1', store)
      sendEvent(actor, { type: 'READ_REQUEST', payload: { key: 'foo' } })
      expect(actor.getState()).toBe('idle')
      // Verify store still has value (reading doesn't modify)
      const entry = store.get('foo')
      expect(entry?.value).toBe('bar')
    })
  })
})
