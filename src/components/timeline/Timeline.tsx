import { useSimulationStore } from '../../store/simulation-store'
import type { Phase } from '../../types/simulation'

const phaseColors: Record<Phase, string> = {
  submit: '#3b82f6',
  controller: '#f59e0b',
  operator: '#ec4899',
  scheduling: '#8b5cf6',
  kubelet: '#06b6d4',
  completed: '#22c55e',
}

export function Timeline() {
  const {
    messages, currentIndex, speed,
    play, pause, stepForward, stepBackward,
    setSpeed, jumpTo, status,
  } = useSimulationStore()

  const isRunning = status === 'running'

  return (
    <div className="bg-gray-900 border-t border-gray-700 p-2">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={isRunning ? pause : play}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
        >
          {isRunning ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={stepBackward}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
        >
          ← Step
        </button>
        <button
          onClick={stepForward}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
        >
          Step →
        </button>

        <div className="flex items-center gap-1 ml-4">
          <span className="text-xs text-gray-400">Speed:</span>
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs ${
                speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-gray-400">
          {currentIndex + 1} / {messages.length}
        </span>
      </div>

      {/* Timeline dots */}
      <div className="flex items-center gap-0.5 overflow-x-auto py-1">
        {messages.map((msg, i) => (
          <button
            key={msg.id}
            onClick={() => jumpTo(i)}
            className={`w-3 h-3 rounded-full shrink-0 transition-all hover:scale-150 ${
              i === currentIndex ? 'ring-2 ring-white scale-125' : ''
            } ${i <= currentIndex ? 'opacity-100' : 'opacity-40'}`}
            style={{ backgroundColor: phaseColors[msg.phase] }}
            title={`${msg.type} (${msg.phase})`}
          />
        ))}
      </div>

      {/* Phase labels */}
      <div className="flex text-xs text-gray-500 mt-1">
        {(['submit', 'controller', 'scheduling', 'kubelet', 'completed'] as Phase[]).map((phase) => (
          <span key={phase} className="flex items-center gap-1 mr-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: phaseColors[phase] }} />
            {phase}
          </span>
        ))}
      </div>
    </div>
  )
}
