import { Handle, Position } from '@xyflow/react'
import type { K8sNodeData } from '../../types/simulation'

const componentColors: Record<string, string> = {
  'api-server': '#326CE5',
  'etcd': '#4CAF50',
  'controller-manager': '#FF9800',
  'scheduler': '#9C27B0',
  'kubelet': '#00BCD4',
  'cri': '#607D8B',
  'cni': '#FF5722',
  'csi': '#795548',
  'deployment-controller': '#3b82f6',
  'replicaset-controller': '#10b981',
  'daemonset-controller': '#f59e0b',
  'job-controller': '#8b5cf6',
  'cronjob-controller': '#ec4899',
}

interface K8sNodeProps {
  data: K8sNodeData
}

export function K8sNode({ data }: K8sNodeProps) {
  const { simNode, isActive, activeError } = data
  const color = simNode.type === 'plugin'
    ? '#E91E63'
    : componentColors[simNode.component] || '#666'

  const displayState = activeError ? 'error' : isActive ? 'processing' : 'idle'

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 text-white text-sm font-medium min-w-[120px] text-center transition-all duration-300 ${
        isActive ? 'scale-110 shadow-lg shadow-white/20' : ''
      } ${activeError ? 'animate-pulse' : ''}`}
      style={{
        borderColor: isActive ? (activeError ? '#ef4444' : '#fff') : color,
        backgroundColor: activeError ? '#7f1d1d' : color,
        borderStyle: simNode.type === 'plugin' ? 'dashed' : 'solid',
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <div className="font-bold">{simNode.label}</div>
      <div className="text-xs opacity-70">{displayState}</div>
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
    </div>
  )
}
