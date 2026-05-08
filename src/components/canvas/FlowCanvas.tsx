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
import { builtinPositions, builtinEdges } from './node-layout'

const nodeTypes = { k8s: K8sNode }

export function FlowCanvas() {
  const { nodes: simNodes, messages, currentIndex } = useSimulationStore()

  const activeFrom = currentIndex >= 0 ? messages[currentIndex]?.from : null
  const activeTo = currentIndex >= 0 ? messages[currentIndex]?.to : null

  const flowNodes: Node[] = useMemo(() => {
    return simNodes.map((sn) => {
      const pos = builtinPositions[sn.id] ?? { x: 600, y: 400 }
      return {
        id: sn.id,
        type: 'k8s',
        position: pos,
        data: {
          simNode: sn,
          isActive: sn.id === activeFrom || sn.id === activeTo,
        },
      }
    })
  }, [simNodes, activeFrom, activeTo])

  const flowEdges: Edge[] = useMemo(() => {
    return builtinEdges.map((e) => {
      const isActive =
        currentIndex >= 0 &&
        messages[currentIndex] &&
        ((messages[currentIndex].from === e.source && messages[currentIndex].to === e.target) ||
         (messages[currentIndex].from === e.target && messages[currentIndex].to === e.source))

      return {
        ...e,
        animated: isActive,
        style: {
          stroke: isActive ? '#3b82f6' : '#555',
          strokeWidth: isActive ? 3 : 1,
        },
        labelStyle: { fill: '#aaa', fontSize: 10 },
      }
    })
  }, [currentIndex, messages])

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
