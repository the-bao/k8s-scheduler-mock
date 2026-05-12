import type { SimEvent } from '../fsm/types'

export class TickClock {
  private running = false
  private speed = 1
  private intervalId: ReturnType<typeof setInterval> | null = null
  private handler: ((event: SimEvent) => void) | null = null

  start(handler: (event: SimEvent) => void): void {
    if (this.running) return
    this.running = true
    this.handler = handler

    this.restartInterval()
  }

  private restartInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
    }
    const intervalMs = 100 / this.speed
    this.intervalId = setInterval(() => {
      if (this.handler) {
        this.handler({ type: 'TICK' })
      }
    }, intervalMs)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.handler = null
  }

  isRunning(): boolean {
    return this.running
  }

  setSpeed(speed: number): void {
    this.speed = speed
    if (this.running) {
      this.restartInterval()
    }
  }

  getSpeed(): number {
    return this.speed
  }
}