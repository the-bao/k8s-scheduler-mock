import { useState, useCallback, useEffect, useRef } from 'react'
import { Simulation } from '../engine/simulation-fsm'
import type { Scenario, PluginConfig, OperatorConfig } from '../types/simulation'

export function useSimulation() {
  const [sim] = useState<Simulation>(() => new Simulation())
  const [status, setStatus] = useState(sim.getStatus())
  const [messages, setMessages] = useState(sim.getMessages())
  const [currentIndex, setCurrentIndex] = useState(sim.getCurrentIndex())
  const [speed, setSpeedState] = useState(sim.getSpeed())
  const [nodes] = useState(sim.getNodes())
  const [resources] = useState(sim.getResources())

  const intervalRef = useRef<number | null>(null)
  const statusRef = useRef(status)

  statusRef.current = status

  // Sync state from simulation
  const syncState = useCallback(() => {
    setStatus(sim.getStatus())
    setMessages(sim.getMessages())
    setCurrentIndex(sim.getCurrentIndex())
  }, [sim])

  // Auto-play interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (status === 'running') {
      const delay = 800 / speed
      intervalRef.current = window.setInterval(() => {
        sim.stepForward()
        syncState()
        if (sim.getStatus() === 'paused') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          setStatus('paused')
        }
      }, delay)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [status, speed, sim, syncState])

  // Control methods
  const play = useCallback(() => {
    sim.play()
    setStatus('running')
  }, [sim])

  const pause = useCallback(() => {
    sim.pause()
    setStatus('paused')
  }, [sim])

  const stepForward = useCallback(() => {
    sim.stepForward()
    syncState()
  }, [sim, syncState])

  const stepBackward = useCallback(() => {
    sim.stepBackward()
    syncState()
  }, [sim, syncState])

  const jumpTo = useCallback((index: number) => {
    sim.jumpTo(index)
    syncState()
  }, [sim, syncState])

  const reset = useCallback(() => {
    sim.reset()
    syncState()
    setStatus('idle')
  }, [sim, syncState])

  const setSpeed = useCallback((newSpeed: number) => {
    sim.setSpeed(newSpeed)
    setSpeedState(newSpeed)
  }, [sim])

  const startSimulation = useCallback((
    podSpec: Record<string, unknown>,
    scenario?: Scenario,
  ) => {
    // Load builtin operators if scenario has operators
    if (scenario?.operators && scenario.operators.length > 0) {
      sim.loadBuiltinOperators()
    }
    sim.start(podSpec, scenario)
    syncState()
    setStatus('running')
  }, [sim, syncState])

  const loadBuiltinOperators = useCallback(() => {
    sim.loadBuiltinOperators()
  }, [sim])

  const addPlugin = useCallback((plugin: PluginConfig) => {
    sim.addPlugin(plugin)
  }, [sim])

  const removePlugin = useCallback((name: string) => {
    sim.removePlugin(name)
  }, [sim])

  const addOperator = useCallback((operator: OperatorConfig) => {
    sim.addOperator(operator)
  }, [sim])

  const removeOperator = useCallback((name: string) => {
    sim.removeOperator(name)
  }, [sim])

  return {
    // State
    status,
    messages,
    currentIndex,
    speed,
    nodes,
    resources,
    plugins: sim.getPlugins(),
    operators: sim.getOperators(),

    // Control methods
    play,
    pause,
    stepForward,
    stepBackward,
    jumpTo,
    reset,
    setSpeed,
    startSimulation,
    loadBuiltinOperators,
    addPlugin,
    removePlugin,
    addOperator,
    removeOperator,

    // Direct access to simulation for advanced use
    simulation: sim,
  }
}
