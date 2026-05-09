// src/engine/simulation.ts

import type {
  SimMessage,
  SimNode,
  ResourceStore,
  NodeResource,
  PluginConfig,
  Scenario,
} from '../types/simulation'

import { resetMsgCounter, createTimestampFactory } from './types'
import { generateSubmitPhase } from './phases/submit'
import { generateControllerPhase } from './phases/controller'
import { generateSchedulingPhase } from './phases/scheduling'
import { generateKubeletPhase } from './phases/kubelet'

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
  resetMsgCounter()
  const { t } = createTimestampFactory()

  const meta = podSpec.metadata as Record<string, unknown> | undefined
  const podName = String(meta?.name ?? 'unknown-pod')
  const namespace = String(meta?.namespace ?? 'default')
  const phaseInput = { podSpec, podName, namespace, t }

  const messages: SimMessage[] = [
    ...generateSubmitPhase(phaseInput),
    ...generateControllerPhase({ ...phaseInput, plugins }),
    ...generateSchedulingPhase({ ...phaseInput, nodeResources: defaultNodeResources }),
    ...generateKubeletPhase(phaseInput),
  ]

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
