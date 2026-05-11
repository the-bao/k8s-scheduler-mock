import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EtcdStore } from '../etcd-store'

describe('EtcdStore', () => {
  let store: EtcdStore

  beforeEach(() => {
    store = new EtcdStore()
  })

  describe('get', () => {
    it('sets and gets a value with revision', () => {
      const revision = store.set('foo', 'bar')
      expect(revision).toBe(1)

      const result = store.get('foo')
      expect(result).toEqual({ value: 'bar', revision: 1 })
    })

    it('increments revision on update', () => {
      store.set('foo', 'v1')
      store.set('foo', 'v2')
      store.set('foo', 'v3')

      const result = store.get('foo')
      expect(result).toEqual({ value: 'v3', revision: 3 })
    })

    it('returns undefined for nonexistent key', () => {
      const result = store.get('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('deletes a key', () => {
      store.set('foo', 'bar')
      const deleted = store.delete('foo')
      expect(deleted).toBe(true)
      expect(store.get('foo')).toBeUndefined()
    })

    it('returns false for nonexistent key', () => {
      const deleted = store.delete('nonexistent')
      expect(deleted).toBe(false)
    })
  })

  describe('list', () => {
    it('lists keys by prefix', () => {
      store.set('deployment/default/app', { name: 'app' })
      store.set('deployment/default/web', { name: 'web' })
      store.set('deployment/kube-system/infra', { name: 'infra' })
      store.set('config/some-key', 'value')

      const results = store.list('deployment/')
      expect(results).toHaveLength(3)
      expect(results.map((r) => r.key)).toEqual([
        'deployment/default/app',
        'deployment/default/web',
        'deployment/kube-system/infra',
      ])
    })

    it('returns empty array for no matches', () => {
      store.set('foo', 'bar')
      const results = store.list('nonexistent/')
      expect(results).toHaveLength(0)
    })
  })

  describe('subscribe', () => {
    it('notifies subscribers on write', () => {
      const handler = vi.fn()
      const unsubscribe = store.subscribe('pod/', handler)

      store.set('pod/node-1', { name: 'pod-1' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({
        type: 'write',
        key: 'pod/node-1',
        value: { name: 'pod-1' },
        revision: 1,
      })

      unsubscribe()
    })

    it('notifies subscribers on delete', () => {
      store.set('pod/node-1', { name: 'pod-1' })
      const handler = vi.fn()
      const unsubscribe = store.subscribe('pod/', handler)

      store.delete('pod/node-1')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({
        type: 'delete',
        key: 'pod/node-1',
        revision: 2,
      })

      unsubscribe()
    })

    it('returns unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = store.subscribe('pod/', handler)

      store.set('pod/node-1', { name: 'pod-1' })
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()
      store.set('pod/node-2', { name: 'pod-2' })
      expect(handler).toHaveBeenCalledTimes(1) // no new calls after unsubscribe
    })

    it('notifies multiple subscribers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      store.subscribe('pod/', handler1)
      store.subscribe('pod/', handler2)

      store.set('pod/node-1', { name: 'pod-1' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })
})