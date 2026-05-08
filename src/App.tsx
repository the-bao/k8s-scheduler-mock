import { useState } from 'react'
import { FlowCanvas } from './components/canvas/FlowCanvas'
import { DetailPanel } from './components/detail/DetailPanel'
import { Timeline } from './components/timeline/Timeline'
import { Toolbar } from './components/toolbar/Toolbar'
import { PluginEditor } from './components/toolbar/PluginEditor'
import { useAutoPlay } from './hooks/useAutoPlay'

export default function App() {
  const [pluginEditorOpen, setPluginEditorOpen] = useState(false)
  useAutoPlay()

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-700">
        <h1 className="font-bold text-sm shrink-0">K8s Pod Lifecycle Visualizer</h1>
        <Toolbar />
        <button
          onClick={() => setPluginEditorOpen(true)}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs shrink-0"
        >
          Plugins
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-[3]">
          <FlowCanvas />
        </div>
        <div className="flex-1 min-w-[280px]">
          <DetailPanel />
        </div>
      </div>

      <Timeline />
      <PluginEditor open={pluginEditorOpen} onClose={() => setPluginEditorOpen(false)} />
    </div>
  )
}
