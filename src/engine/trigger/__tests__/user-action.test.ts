import { describe, it, expect, vi } from 'vitest'
import { UserAction } from '../user-action'
import { MessageBus } from '../../bus/message-bus'
import type { MessageBusLike } from '../../fsm/types'

describe('UserAction', () => {
  describe('dispatch', () => {
    it('creates USER_APPLY event with manifest as payload', () => {
      const bus = new MessageBus()
      const handler = vi.fn()
      bus.subscribe('USER_APPLY', handler)

      const action = new UserAction(bus)
      const manifest = { apiVersion: 'v1', kind: 'Pod', metadata: { name: 'test-pod' } }
      action.dispatch({ type: 'APPLY', manifest })

      expect(handler).toHaveBeenCalledTimes(1)
      const event: SimEvent = handler.mock.calls[0][0]
      expect(event.type).toBe('USER_APPLY')
      expect(event.payload).toEqual(manifest)
    })

    it('creates USER_DELETE event with manifest as payload', () => {
      const bus = new MessageBus()
      const handler = vi.fn()
      bus.subscribe('USER_DELETE', handler)

      const action = new UserAction(bus)
      const manifest = { apiVersion: 'v1', kind: 'Pod', metadata: { name: 'test-pod' } }
      action.dispatch({ type: 'DELETE', manifest })

      expect(handler).toHaveBeenCalledTimes(1)
      const event: SimEvent = handler.mock.calls[0][0]
      expect(event.type).toBe('USER_DELETE')
      expect(event.payload).toEqual(manifest)
    })

    it('creates USER_SCALE event with manifest as payload', () => {
      const bus = new MessageBus()
      const handler = vi.fn()
      bus.subscribe('USER_SCALE', handler)

      const action = new UserAction(bus)
      const manifest = { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'test-deploy' }, spec: { replicas: 3 } }
      action.dispatch({ type: 'SCALE', manifest })

      expect(handler).toHaveBeenCalledTimes(1)
      const event: SimEvent = handler.mock.calls[0][0]
      expect(event.type).toBe('USER_SCALE')
      expect(event.payload).toEqual(manifest)
    })

    it('calls bus.publish with the event', () => {
      const bus = new MessageBus()
      const publishSpy = vi.spyOn(bus, 'publish')

      const action = new UserAction(bus)
      const manifest = { apiVersion: 'v1', kind: 'Pod' }
      action.dispatch({ type: 'APPLY', manifest })

      expect(publishSpy).toHaveBeenCalledTimes(1)
      const event = publishSpy.mock.calls[0][0] as SimEvent
      expect(event.type).toBe('USER_APPLY')
    })
  })
})