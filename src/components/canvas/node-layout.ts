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
  'deployment-controller':  { x: 250, y: 0 },
  'replicaset-controller':  { x: 250, y: -80 },
  'daemonset-controller':   { x: 650, y: 0 },
  'job-controller':         { x: 650, y: -80 },
  'cronjob-controller':     { x: 650, y: -160 },
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
  { id: 'e-etcd-deploy', source: 'etcd', target: 'deployment-controller', label: 'Watch' },
  { id: 'e-deploy-api', source: 'deployment-controller', target: 'api-server', label: 'Write' },
  { id: 'e-etcd-rs', source: 'etcd', target: 'replicaset-controller', label: 'Watch' },
  { id: 'e-rs-api', source: 'replicaset-controller', target: 'api-server', label: 'Write' },
  { id: 'e-etcd-ds', source: 'etcd', target: 'daemonset-controller', label: 'Watch' },
  { id: 'e-ds-api', source: 'daemonset-controller', target: 'api-server', label: 'Write' },
  { id: 'e-etcd-job', source: 'etcd', target: 'job-controller', label: 'Watch' },
  { id: 'e-job-api', source: 'job-controller', target: 'api-server', label: 'Write' },
  { id: 'e-etcd-cj', source: 'etcd', target: 'cronjob-controller', label: 'Watch' },
  { id: 'e-cj-api', source: 'cronjob-controller', target: 'api-server', label: 'Write' },
]

export function buildOperatorEdges(operatorNames: string[]): typeof builtinEdges {
  return operatorNames
    .filter((name) => !builtinPositions[name])
    .map((name) => [
      { id: `e-etcd-${name}`, source: 'etcd', target: name, label: 'Watch' },
      { id: `e-${name}-api`, source: name, target: 'api-server', label: 'Write' },
    ])
    .flat()
}

export function getOperatorPosition(name: string, index: number): { x: number; y: number } {
  return builtinPositions[name] ?? { x: 850, y: -240 - index * 80 }
}
