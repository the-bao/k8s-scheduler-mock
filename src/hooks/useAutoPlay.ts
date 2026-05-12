import { useCallback, useEffect, useRef } from 'react'
import type { Simulation } from '../engine/simulation-fsm'

export function useAutoPlay(sim: Pick<Simulation, 'getStatus' | 'getSpeed' | 'stepForward'>) {
  const intervalRef = useRef<number | null>(null)

  const tick = useCallback(() => {
    sim.stepForward()
  }, [sim])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (sim.getStatus() === 'running') {
      const delay = 800 / sim.getSpeed()
      intervalRef.current = window.setInterval(tick, delay)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [sim, tick])
}
