import { useEffect, useRef } from 'react'
import { useSimulationStore } from '../store/simulation-store'

export function useAutoPlay() {
  const { status, speed, stepForward } = useSimulationStore()
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (status === 'running') {
      const delay = 800 / speed
      intervalRef.current = window.setInterval(() => {
        stepForward()
      }, delay)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [status, speed, stepForward])
}
