import { useState } from 'react'
import { scenarios } from '../../data/scenarios'
import type { Simulation } from '../../engine/simulation-fsm'
import type { SimulationStatus } from '../../types/simulation'

const resourceTypeLabels: Record<string, string> = {
  Pod: 'Pod Scenarios',
  Deployment: 'Deployment Scenarios',
  DaemonSet: 'DaemonSet Scenarios',
  Job: 'Job Scenarios',
}

interface ToolbarProps {
  sim: Pick<Simulation, 'getStatus' | 'reset' | 'loadBuiltinOperators'>
  startSimulation: (podYaml: Record<string, unknown>, scenario?: any) => void
}

export function Toolbar({ sim, startSimulation }: ToolbarProps) {
  const [selectedScenario, setSelectedScenario] = useState('normal')

  const handleStart = () => {
    const scenario = scenarios.find(s => s.id === selectedScenario)
    if (scenario) {
      if (scenario.operators && scenario.operators.length > 0) {
        sim.loadBuiltinOperators()
      }
      startSimulation(scenario.podYaml, scenario)
    }
  }

  const selectedScenarioData = scenarios.find(s => s.id === selectedScenario)
  const buttonText = selectedScenarioData?.resourceType
    ? `Create ${selectedScenarioData.resourceType}`
    : 'Create Pod'

  const grouped = scenarios.reduce<Record<string, typeof scenarios>>((acc, s) => {
    const type = s.resourceType ?? 'Pod'
    if (!acc[type]) acc[type] = []
    acc[type].push(s)
    return acc
  }, {})

  const status: SimulationStatus = sim.getStatus()

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Scenario:</span>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600"
        >
          {Object.entries(grouped).map(([type, group]) => (
            <optgroup key={type} label={resourceTypeLabels[type] ?? type}>
              {group.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <button
        onClick={handleStart}
        disabled={status === 'running'}
        className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded text-xs font-medium"
      >
        {buttonText}
      </button>

      <button
        onClick={sim.reset}
        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
      >
        Reset
      </button>

      <span className={`text-xs ${
        status === 'running' ? 'text-green-400' :
        status === 'paused' ? 'text-yellow-400' :
        status === 'completed' ? 'text-blue-400' :
        'text-gray-400'
      }`}>
        {status.toUpperCase()}
      </span>
    </div>
  )
}
