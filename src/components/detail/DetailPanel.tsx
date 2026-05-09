import { useState } from 'react'
import { useSimulationStore } from '../../store/simulation-store'

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="text-xs text-green-400 bg-gray-900 p-3 rounded overflow-auto max-h-[300px] whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export function DetailPanel() {
  const [tab, setTab] = useState<'request' | 'logs' | 'status'>('request')
  const { messages, currentIndex, resources } = useSimulationStore()

  const currentMsg = currentIndex >= 0 ? messages[currentIndex] : null

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      <div className="flex border-b border-gray-700">
        {(['request', 'logs', 'status'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === 'request' && (
          currentMsg ? (
            <div className="space-y-3">
              <div className="text-xs text-gray-400">
                <span className="text-yellow-400">{currentMsg.type}</span>
                {' '}({currentMsg.phase})
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">From → To</div>
                <div className="text-sm text-white">
                  {currentMsg.from} → {currentMsg.to}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Request</div>
                <JsonBlock data={currentMsg.request} />
              </div>
              {currentMsg.response && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Response</div>
                  <JsonBlock data={currentMsg.response} />
                </div>
              )}
              {currentMsg.error && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 text-red-400">Error</div>
                  <JsonBlock data={currentMsg.error} />
                </div>
              )}
              <div className="text-xs text-gray-500">
                Latency: {currentMsg.latency}ms
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No message selected</div>
          )
        )}

        {tab === 'logs' && (
          <div className="space-y-1 font-mono text-xs">
            {messages.slice(0, currentIndex + 1).map((msg, i) => (
              <div key={msg.id} className={`py-0.5 ${i === currentIndex ? 'bg-gray-800 -mx-1 px-1 rounded' : ''}`}>
                <span className="text-gray-500">{new Date(msg.timestamp).toISOString().slice(11, 23)}</span>{' '}
                <span className="text-cyan-400">[{msg.from}]</span>{' '}
                <span className={msg.error ? 'text-red-400' : 'text-gray-300'}>{msg.type}</span>
                {msg.error && <span className="text-red-400"> ERROR: {msg.error.message}</span>}
              </div>
            ))}
            {currentIndex < 0 && <div className="text-gray-500">No logs yet</div>}
          </div>
        )}

        {tab === 'status' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-2">Pods</div>
              {Object.keys(resources.pods).length === 0 ? (
                <div className="text-gray-600 text-xs">No pods</div>
              ) : (
                Object.entries(resources.pods).map(([name, pod]) => (
                  <div key={name} className="text-xs mb-1">
                    <span className="text-white">{name}</span>{' '}
                    <span className={pod.status === 'Running' ? 'text-green-400' : 'text-yellow-400'}>
                      {pod.status}
                    </span>
                    {pod.nodeName && <span className="text-gray-500"> on {pod.nodeName}</span>}
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Nodes</div>
              {Object.entries(resources.nodes).map(([name, node]) => (
                <div key={name} className="text-xs mb-2">
                  <div className="text-white">{name}</div>
                  <div className="text-gray-400 ml-2">
                    CPU: {node.cpu.used}/{node.cpu.allocatable} | MEM: {node.memory.used}/{node.memory.allocatable}MB
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Custom Resources</div>
              {Object.keys(resources.customResources).length === 0 ? (
                <div className="text-gray-600 text-xs">No custom resources</div>
              ) : (
                Object.entries(resources.customResources).flatMap(([gvk, resourcesByName]) =>
                  Object.entries(resourcesByName).map(([name, cr]) => (
                    <div key={`${gvk}-${name}`} className="text-xs mb-1">
                      <span className="text-white">{name}</span>{' '}
                      <span className="text-cyan-400">{cr.kind}</span>
                      {cr.status?.phase ? <span className="text-yellow-400 ml-1">{String(cr.status.phase)}</span> : null}
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
