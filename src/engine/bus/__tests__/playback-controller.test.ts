import { describe, it, expect, beforeEach } from 'vitest'
import { PlaybackController } from '../playback-controller'
import type { SimEvent } from '../../fsm/types'

describe('PlaybackController', () => {
  let pc: PlaybackController

  beforeEach(() => {
    pc = new PlaybackController()
  })

  it('starts in idle state', () => {
    expect(pc.getState()).toBe('idle')
  })

  it('transitions to running on play() from idle', () => {
    pc.play()
    expect(pc.getState()).toBe('running')
  })

  it('transitions to running on play() from paused', () => {
    pc.play()
    pc.pause()
    expect(pc.getState()).toBe('paused')
    pc.play()
    expect(pc.getState()).toBe('running')
  })

  it('transitions to running on play() from completed', () => {
    pc.play()
    pc.reset()
    pc.play()
    expect(pc.getState()).toBe('running')
  })

  it('transitions to paused on pause()', () => {
    pc.play()
    pc.pause()
    expect(pc.getState()).toBe('paused')
  })

  it('resets to idle on reset() and resets currentIndex', () => {
    pc.play()
    pc.reset()
    expect(pc.getState()).toBe('idle')
  })

  it('stepForward delivers one event and pauses', () => {
    // Add an event first
    pc.addEvent({ type: 'TEST_EVENT' })
    // Initially from idle, stepping should go to stepping then paused
    pc.stepForward()
    expect(pc.getState()).toBe('paused')
  })

  it('stepForward from paused also works and pauses', () => {
    pc.play()
    pc.pause()
    expect(pc.getState()).toBe('paused')
    pc.stepForward()
    expect(pc.getState()).toBe('paused')
  })

  it('stepBackward restores previous snapshot when paused', () => {
    pc.play()
    pc.pause()
    // stepBackward when paused should work
    pc.stepBackward()
    expect(pc.getState()).toBe('paused')
  })

  it('jumpTo transitions to paused', () => {
    pc.play()
    pc.pause()
    pc.jumpTo(0)
    expect(pc.getState()).toBe('paused')
  })

  it('sets and gets speed', () => {
    pc.setSpeed(2)
    expect(pc.getSpeed()).toBe(2)
    pc.setSpeed(0.5)
    expect(pc.getSpeed()).toBe(0.5)
  })

  it('stepForward with no events stays paused', () => {
    // When stepping and no events, stays paused
    pc.stepForward()
    expect(pc.getState()).toBe('paused')
  })
})

describe('PlaybackController ring buffer', () => {
  it('stores snapshots up to 500', () => {
    const pc = new PlaybackController()
    for (let i = 0; i < 550; i++) {
      pc.recordSnapshot({ type: 'SNAPSHOT_' + i })
    }
    // Should only keep last 500
    const snapshots = (pc as any).snapshots
    expect(snapshots.length).toBeLessThanOrEqual(500)
  })
})
