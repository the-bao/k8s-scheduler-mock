// src/engine/bus/playback-controller.ts

import type { SimEvent } from '../fsm/types'

export type PlaybackState = 'idle' | 'running' | 'paused' | 'completed' | 'stepping'

const MAX_SNAPSHOTS = 500

interface Snapshot {
  index: number
  event?: SimEvent
  timestamp: number
}

export class PlaybackController {
  private state: PlaybackState = 'idle'
  private currentIndex: number = -1
  private speed: number = 1
  private snapshots: Snapshot[] = []
  private events: SimEvent[] = []

  getState(): PlaybackState {
    return this.state
  }

  play(): void {
    if (this.state === 'idle' || this.state === 'paused' || this.state === 'completed') {
      this.state = 'running'
    }
  }

  pause(): void {
    if (this.state === 'running') {
      this.state = 'paused'
    }
  }

  reset(): void {
    this.state = 'idle'
    this.currentIndex = -1
    this.events = []
  }

  stepForward(): void {
    if (this.state === 'idle') {
      this.state = 'stepping'
      this.currentIndex++
      if (this.currentIndex < this.events.length) {
        this.recordSnapshot({ index: this.currentIndex, event: this.events[this.currentIndex] })
        this.state = 'paused'
      } else {
        // No events, just stay paused
        this.state = 'paused'
      }
    } else if (this.state === 'paused') {
      this.currentIndex++
      if (this.currentIndex < this.events.length) {
        this.recordSnapshot({ index: this.currentIndex, event: this.events[this.currentIndex] })
        this.state = 'paused'
      } else {
        // No more events, stay paused
        this.state = 'paused'
      }
    }
  }

  stepBackward(): void {
    if (this.state === 'paused' && this.currentIndex > 0) {
      this.currentIndex--
      // Restore previous snapshot
      this.state = 'paused'
    }
  }

  jumpTo(index: number): void {
    if (this.state === 'paused') {
      this.currentIndex = index
      this.state = 'paused'
    }
  }

  setSpeed(speed: number): void {
    this.speed = speed
  }

  getSpeed(): number {
    return this.speed
  }

  recordSnapshot(snapshot: Omit<Snapshot, 'timestamp'>): void {
    const fullSnapshot: Snapshot = {
      ...snapshot,
      timestamp: Date.now(),
    }
    this.snapshots.push(fullSnapshot)

    // Ring buffer: keep only last MAX_SNAPSHOTS
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.shift()
    }
  }

  addEvent(event: SimEvent): void {
    this.events.push(event)
  }

  getCurrentIndex(): number {
    return this.currentIndex
  }

  getEvents(): SimEvent[] {
    return [...this.events]
  }

  getSnapshots(): Snapshot[] {
    return [...this.snapshots]
  }
}
