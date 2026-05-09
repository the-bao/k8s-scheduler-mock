import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import { useSimulationStore } from '../../store/simulation-store'
import { K8sNode } from './K8sNode'
import { builtinPositions, builtinEdges, buildOperatorEdges, getOperatorPosition } from './node-layout'

const nodeTypes = { k8s: K8sNode }

export function FlowCanvas() {
  const { nodes: simNodes, messages, currentIndex } = useSimulationStore()

  const currentMsg = currentIndex >= 0 ? messages[currentIndex] : null
  const activeFrom = currentMsg?.from ?? null
  const activeTo = currentMsg?.to ?? null
  const hasError = !!currentMsg?.error

  const flowNodes: Node[] = useMemo(() => {
    return simNodes.map((sn, i) => {
      const pos = builtinPositions[sn.id] ?? getOperatorPosition(sn.id, i)
      const isActive = sn.id === activeFrom || sn.id === activeTo
      return {
        id: sn.id,
        type: 'k8s',
        position: pos,
        data: {
          simNode: sn,
          isActive,
          activeError: isActive && hasError,
        },
      }
    })
  }, [simNodes, activeFrom, activeTo, hasError])

  const flowEdges: Edge[] = useMemo(() => {
    const operatorNames = simNodes
      .filter(sn => sn.id.includes('-controller') || sn.id.includes('-operator'))
      .map(sn => sn.id)
    const allEdges = [...builtinEdges, ...buildOperatorEdges(operatorNames)]

    return allEdges.map((e) => {
      const isActive = !!currentMsg &&
        ((currentMsg.from === e.source && currentMsg.to === e.target) ||
         (currentMsg.from === e.target && currentMsg.to === e.source))
      return {
        ...e,
        animated: isActive,
        style: {
          stroke: isActive ? (currentMsg?.error ? '#ef4444' : '#3b82f6') : '#555',
          strokeWidth: isActive ? 3 : 1,
        },
        labelStyle: { fill: '#aaa', fontSize: 10 },
      }
    })
  }, [currentMsg, simNodes])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#333" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-600 [&>button]:!bg-gray-800 [&>button]:!border-gray-600 [&>button]:!text-white [&>button:hover]:!bg-gray-700" />
        <MiniMap
          nodeColor={() => '#326CE5'}
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-gray-800 !border-gray-600"
        />
      </ReactFlow>
    </div>
  )
}
