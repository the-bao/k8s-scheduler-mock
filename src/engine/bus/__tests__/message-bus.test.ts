import { describe, it, expect } from 'vitest'
import { MessageBus } from '../message-bus'
import type { SimEvent } from '../../fsm/types'

describe('MessageBus', () => {
  describe('publish', () => {
    it('calls all handlers subscribed to that event type', () => {
      const bus = new MessageBus()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.subscribe('TestEvent', handler1)
      bus.subscribe('TestEvent', handler2)

      const event: SimEvent = { type: 'TestEvent' }
      bus.publish(event)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler1).toHaveBeenCalledWith(event)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledWith(event)
    })

    it('does NOT call handlers of different event types', () => {
      const bus = new MessageBus()
      const testEventHandler = vi.fn()
      const otherEventHandler = vi.fn()

      bus.subscribe('TestEvent', testEventHandler)
      bus.subscribe('OtherEvent', otherEventHandler)

      const event: SimEvent = { type: 'TestEvent' }
      bus.publish(event)

      expect(testEventHandler).toHaveBeenCalledTimes(1)
      expect(otherEventHandler).not.toHaveBeenCalled()
    })
  })

  describe('route', () => {
    it('delivers event to handler', () => {
      const bus = new MessageBus()
      const handler = vi.fn()

      bus.subscribe('RouteEvent', handler)

      const event: SimEvent = { type: 'RouteEvent', to: 'target' }
      bus.route('target', event)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(event)
    })
  })

  describe('subscribe', () => {
    it('returns unsubscribe function that removes handler', () => {
      const bus = new MessageBus()
      const handler = vi.fn()

      const unsubscribe = bus.subscribe('UnsubEvent', handler)
      unsubscribe()

      const event: SimEvent = { type: 'UnsubEvent' }
      bus.publish(event)

      expect(handler).not.toHaveBeenCalled()
    })
  })
})