import { useState } from 'react'
import { useSimulationStore } from '../../store/simulation-store'
import { scenarios } from '../../data/scenarios'

export function Toolbar() {
  const { startSimulation, status, reset } = useSimulationStore()
  const [selectedScenario, setSelectedScenario] = useState('normal')

  const handleStart = () => {
    const scenario = scenarios.find(s => s.id === selectedScenario)
    if (scenario) {
      startSimulation(scenario.podYaml, scenario)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Scenario:</span>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleStart}
        disabled={status === 'running'}
        className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded text-xs font-medium"
      >
        Create Pod
      </button>

      <button
        onClick={reset}
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
