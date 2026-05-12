// src/engine/simulation.ts
//
// DEPRECATED: The functions below (getDefaultNodes, getDefaultResources, generateMessages)
// exist for backward compatibility during migration.
// The new FSM-driven approach uses the Simulation class and actor state transitions instead.

import type { SimulationStatus, SimMessage, PluginConfig, Scenario, OperatorConfig, SimNode } from '../types/simulation'

export function getDefaultNodes(): SimNode[] {
  const components = ['api-server', 'etcd', 'controller-manager', 'scheduler', 'kubelet', 'cri', 'cni', 'csi']
  return components.map((c) => ({
    id: c,
    type: 'builtin' as const,
    component: c,
    label: c,
    state: 'idle' as const,
  }))
}

export function getDefaultResources() {
  return {
    pods: {},
    nodes: {
      'node-1': {
        name: 'node-1',
        cpu: { capacity: 8, allocatable: 8, used: 0 },
        memory: { capacity: 32, allocatable: 32, used: 0 },
        labels: { 'kubernetes.io/os': 'linux' },
      },
      'node-2': {
        name: 'node-2',
        cpu: { capacity: 4, allocatable: 4, used: 0 },
        memory: { capacity: 16, allocatable: 16, used: 0 },
        labels: { 'kubernetes.io/os': 'linux' },
      },
    },
    pvcs: {},
    configmaps: {},
    customResources: {},
  }
}

// Deprecated: use the new Simulation class (src/engine/simulation-fsm.ts) instead
export function generateMessages(
  _podSpec: Record<string, unknown>,
  _plugins: PluginConfig[],
  _scenario?: Scenario,
  _operators?: OperatorConfig[],
): SimMessage[] {
  return []
}

export type { SimulationStatus }
