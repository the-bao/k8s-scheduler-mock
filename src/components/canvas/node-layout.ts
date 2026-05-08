import type { K8sNodeData } from '../../types/simulation'

export const builtinPositions: Record<string, { x: number; y: number }> = {
  'user':               { x: 50, y: 300 },
  'api-server':         { x: 250, y: 300 },
  'etcd':               { x: 450, y: 300 },
  'controller-manager': { x: 450, y: 100 },
  'scheduler':          { x: 450, y: 500 },
  'kubelet':            { x: 700, y: 300 },
  'cri':                { x: 950, y: 200 },
  'cni':                { x: 950, y: 350 },
  'csi':                { x: 950, y: 500 },
}

export const builtinEdges = [
  { id: 'e-user-api', source: 'user', target: 'api-server', label: 'kubectl' },
  { id: 'e-api-etcd', source: 'api-server', target: 'etcd', label: 'HTTP' },
  { id: 'e-etcd-ctrl', source: 'etcd', target: 'controller-manager', label: 'Watch' },
  { id: 'e-etcd-sched', source: 'etcd', target: 'scheduler', label: 'Watch' },
  { id: 'e-sched-api', source: 'scheduler', target: 'api-server', label: 'Bind' },
  { id: 'e-etcd-kubelet', source: 'etcd', target: 'kubelet', label: 'Watch' },
  { id: 'e-kubelet-api', source: 'kubelet', target: 'api-server', label: 'Status' },
  { id: 'e-kubelet-cri', source: 'kubelet', target: 'cri', label: 'gRPC' },
  { id: 'e-kubelet-cni', source: 'kubelet', target: 'cni', label: 'CNI' },
  { id: 'e-kubelet-csi', source: 'kubelet', target: 'csi', label: 'CSI' },
]
