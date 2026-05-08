import { useCallback, useEffect, useRef } from 'react'
import { useSimulationStore } from '../store/simulation-store'

export function useAutoPlay() {
  const status = useSimulationStore((s) => s.status)
  const speed = useSimulationStore((s) => s.speed)
  const stepForward = useSimulationStore((s) => s.stepForward)
  const intervalRef = useRef<number | null>(null)
  const stepRef = useRef(stepForward)

  stepRef.current = stepForward

  const tick = useCallback(() => {
    stepRef.current()
  }, [])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (status === 'running') {
      const delay = 800 / speed
      intervalRef.current = window.setInterval(tick, delay)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [status, speed, tick])
}
