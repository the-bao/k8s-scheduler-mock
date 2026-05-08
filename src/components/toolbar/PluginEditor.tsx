import { useState } from 'react'
import yaml from 'js-yaml'
import { useSimulationStore } from '../../store/simulation-store'
import type { PluginConfig } from '../../types/simulation'

const defaultOperatorYaml = `apiVersion: sim.k8s.io/v1
kind: OperatorPlugin
metadata:
  name: my-operator
  watchResources:
    - pods
spec:
  reconcile:
    - match:
        resource: pods
        labelSelector:
          app: my-app
      actions:
        - type: createResource
          resource:
            apiVersion: v1
            kind: ConfigMap
            name: my-app-config
            data:
              key: value
ui:
  icon: cog
  color: "#e74c3c"
  position: right
`

const defaultCniYaml = `apiVersion: sim.k8s.io/v1
kind: CNIPlugin
metadata:
  name: my-cni
spec:
  actions:
    - type: setupNetwork
    - type: assignIP
ui:
  icon: network
  color: "#ff5722"
  position: right
`

const defaultCsiYaml = `apiVersion: sim.k8s.io/v1
kind: CSIPlugin
metadata:
  name: my-csi
spec:
  actions:
    - type: provisionVolume
    - type: mountVolume
ui:
  icon: storage
  color: "#795548"
  position: right
`

export function PluginEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { plugins, addPlugin, removePlugin } = useSimulationStore()
  const [yamlText, setYamlText] = useState(defaultOperatorYaml)
  const [error, setError] = useState('')

  if (!open) return null

  const handleAdd = () => {
    try {
      const parsed = yaml.load(yamlText) as PluginConfig
      if (!parsed.apiVersion || !parsed.kind || !parsed.metadata?.name) {
        setError('Missing required fields: apiVersion, kind, metadata.name')
        return
      }
      addPlugin(parsed)
      setError('')
    } catch (e) {
      setError(`YAML parse error: ${(e as Error).message}`)
    }
  }

  const templates = [
    { label: 'Operator', yaml: defaultOperatorYaml },
    { label: 'CNI Plugin', yaml: defaultCniYaml },
    { label: 'CSI Plugin', yaml: defaultCsiYaml },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-bold text-sm">Plugin Manager</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">X</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Loaded plugins */}
          {plugins.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-2">Loaded Plugins</div>
              {plugins.map((p) => (
                <div key={p.metadata.name} className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded mb-1">
                  <div>
                    <span className="text-white text-xs font-medium">{p.metadata.name}</span>
                    <span className="text-gray-400 text-xs ml-2">{p.kind}</span>
                  </div>
                  <button
                    onClick={() => removePlugin(p.metadata.name)}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Template buttons */}
          <div className="flex gap-2">
            {templates.map((t) => (
              <button
                key={t.label}
                onClick={() => { setYamlText(t.yaml); setError('') }}
                className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600"
              >
                {t.label} Template
              </button>
            ))}
          </div>

          {/* YAML editor */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Plugin YAML</div>
            <textarea
              value={yamlText}
              onChange={(e) => { setYamlText(e.target.value); setError('') }}
              className="w-full h-[250px] bg-gray-900 text-green-400 text-xs p-3 rounded border border-gray-600 font-mono resize-none"
              spellCheck={false}
            />
          </div>

          {error && <div className="text-red-400 text-xs">{error}</div>}

          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium"
          >
            Add Plugin
          </button>
        </div>
      </div>
    </div>
  )
}
