import { describe, it, expect, vi } from 'vitest'
import type { SimEvent, ActorContext } from '../types'

describe('SimEvent', () => {
  it('should have type field', () => {
    const event: SimEvent = { type: 'TestEvent' }
    expect(event.type).toBe('TestEvent')
  })

  it('should support from/to fields for state transitions', () => {
    const event: SimEvent = { type: 'Transition', from: 'idle', to: 'running' }
    expect(event.from).toBe('idle')
    expect(event.to).toBe('running')
  })

  it('should support optional payload', () => {
    const event: SimEvent = { type: 'Data', payload: { key: 'value' } }
    expect(event.payload).toEqual({ key: 'value' })
  })

  it('should support optional timestamp', () => {
    const ts = Date.now()
    const event: SimEvent = { type: 'Timed', ts }
    expect(event.ts).toBe(ts)
  })
})

describe('ActorContext', () => {
  it('should require actorId', () => {
    const ctx: ActorContext = {
      actorId: 'actor-1',
      bus: {
        publish: vi.fn(),
        route: vi.fn(),
      },
    }
    expect(ctx.actorId).toBe('actor-1')
  })

  it('should include bus', () => {
    const bus = {
      publish: vi.fn(),
      route: vi.fn(),
    }
    const ctx: ActorContext = { actorId: 'test', bus }
    expect(ctx.bus).toBe(bus)
  })

  it('should allow additional string-keyed properties', () => {
    const ctx: ActorContext = {
      actorId: 'test',
      bus: { publish: vi.fn(), route: vi.fn() },
      customProp: 'value',
    }
    expect(ctx.customProp).toBe('value')
  })
})

describe('MessageBusLike', () => {
  it('should have publish method', () => {
    const bus: MessageBusLike = {
      publish: vi.fn(),
      route: vi.fn(),
    }
    const event: SimEvent = { type: 'Test' }
    bus.publish(event)
    expect(bus.publish).toHaveBeenCalledWith(event)
  })

  it('should have route method', () => {
    const bus: MessageBusLike = {
      publish: vi.fn(),
      route: vi.fn(),
    }
    const event: SimEvent = { type: 'Test' }
    bus.route('target', event)
    expect(bus.route).toHaveBeenCalledWith('target', event)
  })
})