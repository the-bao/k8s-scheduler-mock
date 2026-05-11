import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TickClock } from '../tick-clock'

describe('TickClock', () => {
  let clock: TickClock

  beforeEach(() => {
    clock = new TickClock()
  })

  afterEach(() => {
    clock.stop()
  })

  describe('initial state', () => {
    it('starts in stopped state', () => {
      expect(clock.isRunning()).toBe(false)
    })
  })

  describe('start / stop', () => {
    it('starts running and can be stopped', () => {
      const handler = vi.fn()
      clock.start(handler)
      expect(clock.isRunning()).toBe(true)
      clock.stop()
      expect(clock.isRunning()).toBe(false)
    })

    it('emits TICK events while running', () => {
      vi.useFakeTimers()
      const handler = vi.fn()
      clock.start(handler)

      // Advance timer to trigger the interval
      vi.advanceTimersByTime(100)
      expect(handler).toHaveBeenCalled()
      expect(handler.mock.calls[0][0].type).toBe('TICK')

      clock.stop()
      vi.useRealTimers()
    })

    it('stops emitting after stop() is called', () => {
      vi.useFakeTimers()
      const handler = vi.fn()
      clock.start(handler)

      // First tick
      vi.advanceTimersByTime(100)
      handler.mockClear()

      clock.stop()

      // Should not emit any more ticks
      vi.advanceTimersByTime(200)
      expect(handler).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('setSpeed / getSpeed', () => {
    it('defaults to speed 1', () => {
      expect(clock.getSpeed()).toBe(1)
    })

    it('setSpeed changes the tick interval', () => {
      vi.useFakeTimers()
      const handler = vi.fn()
      clock.start(handler)

      // Speed 1 ticks every 100ms
      vi.advanceTimersByTime(100)
      expect(handler).toHaveBeenCalledTimes(1)
      handler.mockClear()

      // Increase speed to 5 (interval = 100/5 = 20ms)
      clock.setSpeed(5)
      vi.advanceTimersByTime(20)
      expect(handler).toHaveBeenCalledTimes(1)

      clock.stop()
      vi.useRealTimers()
    })

    it('getSpeed returns the current speed', () => {
      clock.setSpeed(3)
      expect(clock.getSpeed()).toBe(3)
    })
  })
})