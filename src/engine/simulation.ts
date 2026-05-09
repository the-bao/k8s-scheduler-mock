// src/engine/simulation.ts

import type {
  SimMessage,
  SimNode,
  ResourceStore,
  NodeResource,
  PluginConfig,
  Scenario,
  PluginAction,
} from '../types/simulation'

// ── Message ID counter ────────────────────────────────────────────────
let msgCounter = 0

function nextMsgId(): string {
  return `msg-${++msgCounter}`
}

// ── Builtin nodes ─────────────────────────────────────────────────────
const builtinComponents = [
  'api-server',
  'etcd',
  'controller-manager',
  'scheduler',
  'kubelet',
  'cri',
  'cni',
  'csi',
] as const

const builtinNodes: SimNode[] = builtinComponents.map((c) => ({
  id: c,
  type: 'builtin',
  component: c,
  label: c,
  state: 'idle',
}))

// ── Default node resources ────────────────────────────────────────────
const defaultNodeResources: NodeResource[] = [
  {
    name: 'node-1',
    cpu: { capacity: 8, allocatable: 8, used: 0 },
    memory: { capacity: 32, allocatable: 32, used: 0 },
    labels: { 'kubernetes.io/os': 'linux' },
  },
  {
    name: 'node-2',
    cpu: { capacity: 4, allocatable: 4, used: 0 },
    memory: { capacity: 16, allocatable: 16, used: 0 },
    labels: { 'kubernetes.io/os': 'linux' },
  },
]

// ── Message generator ─────────────────────────────────────────────────
export function generateMessages(
  podSpec: Record<string, unknown>,
  plugins: PluginConfig[],
  scenario?: Scenario,
): SimMessage[] {
  msgCounter = 0
  const ts = Date.now()
  let offset = 0
  const t = () => ts + offset++

  const meta = podSpec.metadata as Record<string, unknown> | undefined
  const podName = String(meta?.name ?? 'unknown-pod')
  const namespace = String(meta?.namespace ?? 'default')

  const messages: SimMessage[] = []

  // ── Phase 1: submit ──────────────────────────────────────────────────
  messages.push({
    id: nextMsgId(),
    from: 'user',
    to: 'api-server',
    phase: 'submit',
    type: 'CREATE_POD',
    request: { pod: podSpec },
    latency: 5,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'api-server',
    to: 'etcd',
    phase: 'submit',
    type: 'WRITE_POD',
    request: { key: `/registry/pods/${namespace}/${podName}`, value: podSpec },
    latency: 12,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'etcd',
    to: 'api-server',
    phase: 'submit',
    type: 'WRITE_POD_RESPONSE',
    request: {},
    response: { revision: 1 },
    latency: 8,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'api-server',
    to: 'user',
    phase: 'submit',
    type: 'CREATE_POD_RESPONSE',
    request: {},
    response: { uid: `${namespace}/${podName}`, created: true },
    latency: 3,
    timestamp: t(),
  })

  // ── Phase 2: controller ──────────────────────────────────────────────
  messages.push({
    id: nextMsgId(),
    from: 'etcd',
    to: 'controller-manager',
    phase: 'controller',
    type: 'WATCH_EVENT_POD_ADDED',
    request: { pod: podSpec },
    latency: 2,
    timestamp: t(),
  })

  // Emit operator plugin messages
  const operatorPlugins = plugins.filter((p) => p.kind === 'OperatorPlugin')
  for (const plugin of operatorPlugins) {
    const rules = plugin.spec.reconcile ?? []
    for (const rule of rules) {
      for (const action of rule.actions) {
        messages.push(
          buildOperatorMessage(plugin, action, podName, namespace, t),
        )
      }
    }
    // Also emit for top-level actions if no reconcile rules
    if (rules.length === 0 && plugin.spec.actions) {
      for (const action of plugin.spec.actions) {
        messages.push(
          buildOperatorMessage(plugin, action, podName, namespace, t),
        )
      }
    }
  }

  // ── Phase 3: scheduling ──────────────────────────────────────────────
  messages.push({
    id: nextMsgId(),
    from: 'etcd',
    to: 'scheduler',
    phase: 'scheduling',
    type: 'WATCH_EVENT_UNSCHEDULED_POD',
    request: { podName, namespace },
    latency: 3,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'scheduler',
    to: 'scheduler',
    phase: 'scheduling',
    type: 'FILTER_NODES',
    request: {
      podName,
      candidates: defaultNodeResources.map((n) => n.name),
    },
    response: {
      feasible: defaultNodeResources.map((n) => n.name),
    },
    latency: 15,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'scheduler',
    to: 'scheduler',
    phase: 'scheduling',
    type: 'SCORE_NODES',
    request: { podName, candidates: defaultNodeResources.map((n) => n.name) },
    response: {
      scores: [
        { node: 'node-1', score: 65 },
        { node: 'node-2', score: 42 },
      ],
      selectedNode: 'node-1',
    },
    latency: 20,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'scheduler',
    to: 'api-server',
    phase: 'scheduling',
    type: 'BIND_POD',
    request: { podName, namespace, node: 'node-1' },
    response: { bound: true },
    latency: 8,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'api-server',
    to: 'etcd',
    phase: 'scheduling',
    type: 'UPDATE_POD_BIND',
    request: {
      key: `/registry/pods/${namespace}/${podName}`,
      patch: { spec: { nodeName: 'node-1' } },
    },
    response: { revision: 2 },
    latency: 10,
    timestamp: t(),
  })

  // ── Phase 4: kubelet ─────────────────────────────────────────────────
  messages.push({
    id: nextMsgId(),
    from: 'etcd',
    to: 'kubelet',
    phase: 'kubelet',
    type: 'WATCH_EVENT_POD_BOUND',
    request: { podName, namespace, node: 'node-1' },
    latency: 3,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'kubelet',
    to: 'cri',
    phase: 'kubelet',
    type: 'CREATE_SANDBOX',
    request: { podName, namespace },
    response: { sandboxId: 'sandbox-abc123' },
    latency: 120,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'kubelet',
    to: 'cni',
    phase: 'kubelet',
    type: 'CNI_SETUP',
    request: { podName, namespace, sandboxId: 'sandbox-abc123' },
    response: { ip: '10.244.1.5' },
    latency: 45,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'kubelet',
    to: 'csi',
    phase: 'kubelet',
    type: 'CSI_STAGE_VOLUME',
    request: { podName, volumeId: 'vol-001' },
    response: { staged: true },
    latency: 80,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'kubelet',
    to: 'csi',
    phase: 'kubelet',
    type: 'CSI_PUBLISH_VOLUME',
    request: { podName, volumeId: 'vol-001' },
    response: { published: true, targetPath: '/var/lib/kubelet/pods/abc/volumes' },
    latency: 35,
    timestamp: t(),
  })

  // Pull image for the first container (or a default)
  const containers =
    (podSpec.spec as Record<string, unknown>)?.containers as
      | { name: string; image: string }[]
      | undefined
      ?? [{ name: 'main', image: 'nginx:latest' }]
  const firstContainer = containers[0]

  messages.push({
    id: nextMsgId(),
    from: 'kubelet',
    to: 'cri',
    phase: 'kubelet',
    type: 'PULL_IMAGE',
    request: { image: firstContainer.image },
    response: { imageId: `sha256:${firstContainer.image}` },
    latency: 2500,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'kubelet',
    to: 'cri',
    phase: 'kubelet',
    type: 'START_CONTAINER',
    request: {
      podName,
      containerName: firstContainer.name,
      image: firstContainer.image,
    },
    response: { containerId: 'ctr-xyz789' },
    latency: 200,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'kubelet',
    to: 'api-server',
    phase: 'kubelet',
    type: 'UPDATE_POD_STATUS',
    request: {
      podName,
      namespace,
      status: { phase: 'Running', podIP: '10.244.1.5' },
    },
    response: { updated: true },
    latency: 10,
    timestamp: t(),
  })

  messages.push({
    id: nextMsgId(),
    from: 'api-server',
    to: 'etcd',
    phase: 'kubelet',
    type: 'WRITE_POD_STATUS',
    request: {
      key: `/registry/pods/${namespace}/${podName}`,
      patch: { status: { phase: 'Running', podIP: '10.244.1.5' } },
    },
    response: { revision: 3 },
    latency: 8,
    timestamp: t(),
  })

  // ── Apply scenario error injections ──────────────────────────────────
  if (scenario?.injectErrors) {
    for (const injection of scenario.injectErrors) {
      const target = messages.find(
        (m) => m.phase === injection.phase && m.type === injection.messageType,
      )
      if (target) {
        target.error = injection.error
      }
    }
  }

  return messages
}

// ── Helper: build an operator plugin message ──────────────────────────
function buildOperatorMessage(
  plugin: PluginConfig,
  action: PluginAction,
  podName: string,
  namespace: string,
  t: () => number,
): SimMessage {
  return {
    id: nextMsgId(),
    from: plugin.metadata.name,
    to: 'api-server',
    phase: 'controller',
    type: `OPERATOR_${action.type.toUpperCase()}`,
    request: {
      action: action.type,
      resource: action.resource ?? { podName, namespace },
      patch: action.patch,
    },
    response: action.error ? undefined : { applied: true },
    error: action.error ? { ...action.error, retryable: false } : undefined,
    latency: 15,
    timestamp: t(),
  }
}

// ── Accessors ─────────────────────────────────────────────────────────
export function getDefaultNodes(): SimNode[] {
  return builtinNodes.map((n) => ({ ...n }))
}

export function getDefaultResources(): ResourceStore {
  const nodes: ResourceStore['nodes'] = {}
  for (const nr of defaultNodeResources) {
    nodes[nr.name] = {
      ...nr,
      cpu: { ...nr.cpu },
      memory: { ...nr.memory },
      labels: { ...nr.labels },
    }
  }
  return {
    pods: {},
    nodes,
    pvcs: {},
    configmaps: {},
    customResources: {},
  }
}
