// src/types/simulation.ts

export type Phase = 'submit' | 'controller' | 'operator' | 'scheduling' | 'kubelet' | 'completed'

export type ComponentType =
  | 'api-server'
  | 'etcd'
  | 'controller-manager'
  | 'scheduler'
  | 'kubelet'
  | 'cri'
  | 'cni'
  | 'csi'
  | string // custom plugin

export interface SimError {
  code: number
  message: string
  retryable: boolean
}

export interface SimMessage {
  id: string
  from: string
  to: string
  phase: Phase
  type: string
  request: Record<string, unknown>
  response?: Record<string, unknown>
  error?: SimError
  latency: number
  timestamp: number
}

export type SimNodeState = 'idle' | 'processing' | 'error'

export interface SimNode {
  id: string
  type: 'builtin' | 'plugin'
  component: ComponentType
  label: string
  state: SimNodeState
}

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

export interface ResourceStore {
  pods: Record<string, PodResource>
  nodes: Record<string, NodeResource>
  pvcs: Record<string, PVCResource>
  configmaps: Record<string, Record<string, unknown>>
  customResources: Record<string, Record<string, CustomResource>>
}

export interface PodResource {
  name: string
  namespace: string
  status: string
  nodeName: string
  labels: Record<string, string>
  containers: ContainerSpec[]
  conditions: PodCondition[]
  ip?: string
}

export interface ContainerSpec {
  name: string
  image: string
  resources: { cpu: string; memory: string }
}

export interface PodCondition {
  type: string
  status: string
  reason?: string
}

export interface NodeResource {
  name: string
  cpu: { capacity: number; allocatable: number; used: number }
  memory: { capacity: number; allocatable: number; used: number }
  labels: Record<string, string>
}

export interface PVCResource {
  name: string
  namespace: string
  storageClassName: string
  accessModes: string[]
  capacity: string
  phase: string
}

export interface Simulation {
  status: SimulationStatus
  messages: SimMessage[]
  currentIndex: number
  speed: number
  resources: ResourceStore
  nodes: SimNode[]
  plugins: PluginConfig[]
  breakpoints: string[]
}

// Plugin types

export type PluginKind = 'OperatorPlugin' | 'CNIPlugin' | 'CSIPlugin'

export interface PluginMatch {
  resource: string
  labelSelector?: Record<string, string>
}

export interface PluginAction {
  type: string
  resource?: Record<string, unknown>
  patch?: Record<string, unknown>
  error?: { code: number; message: string }
}

export interface PluginReconcileRule {
  match: PluginMatch
  actions: PluginAction[]
}

export interface PluginUI {
  icon: string
  color: string
  position: 'left' | 'right' | 'top' | 'bottom'
}

export interface PluginConfig {
  apiVersion: string
  kind: PluginKind
  metadata: {
    name: string
    watchResources?: string[]
  }
  spec: {
    reconcile?: PluginReconcileRule[]
    actions?: PluginAction[]
  }
  ui: PluginUI
}

// ── Operator Framework types ──────────────────────────────────────────

export interface CRDSpec {
  group: string
  version: string
  kind: string
  plural: string
  scope: 'Namespaced' | 'Cluster'
  versions: CRDVersion[]
}

export interface CRDVersion {
  name: string
  served: boolean
  storage: boolean
  schema: Record<string, unknown>
}

export interface ReconcileRule {
  watchResource: string
  labelSelector?: Record<string, string>
  onEvent: 'Added' | 'Modified' | 'Deleted'
  condition?: string
  actions: ReconcileAction[]
}

export interface ReconcileAction {
  type: 'createResource' | 'updateResource' | 'deleteResource' | 'updateStatus' | 'sendEvent'
  target?: {
    apiVersion: string
    kind: string
    name?: string
    namespace?: string
  }
  template?: Record<string, unknown>
  patch?: Record<string, unknown>
  error?: { code: number; message: string; retryable: boolean }
}

export interface OperatorConfig {
  apiVersion: string
  kind: 'OperatorConfig'
  metadata: {
    name: string
    managedCRD: CRDSpec
  }
  spec: {
    watchResources: string[]
    reconcile: ReconcileRule[]
    statusConditions?: StatusConditionDef[]
  }
  ui: PluginUI
}

export interface StatusConditionDef {
  type: string
  reason: string
  message: string
  targetStatus: string
}

export interface CustomResource {
  apiVersion: string
  kind: string
  metadata: { name: string; namespace: string; uid?: string; labels?: Record<string, string> }
  spec: Record<string, unknown>
  status: Record<string, unknown>
}

export interface Controller {
  name: string
  config: OperatorConfig
  reconcile(event: ReconcileEvent, nodeNames?: string[]): ReconcileResult[]
}

export interface ReconcileEvent {
  eventType: 'Added' | 'Modified' | 'Deleted'
  resource: Record<string, unknown>
  existingResources: CustomResource[]
}

export interface ReconcileResult {
  messages: SimMessage[]
  resourceChanges: { created?: CustomResource; updated?: CustomResource; deleted?: string }
}

// Scenario types

export interface Scenario {
  id: string
  name: string
  description: string
  podYaml: Record<string, unknown>
  injectErrors?: { phase: Phase; messageType: string; error: SimError }[]
  resourceType?: 'Pod' | 'Deployment' | 'DaemonSet' | 'Job' | 'CronJob'
  operators?: string[]
}

// React Flow node data

export interface K8sNodeData {
  simNode: SimNode
  isActive: boolean
  activeError?: boolean
}
