// src/engine/phases/scheduling.ts

import type { SimMessage, NodeResource } from '../../types/simulation'
import { makeMessage } from '../types'
import type { PhaseInput } from '../types'

export interface SchedulingPhaseInput extends PhaseInput {
  nodeResources: NodeResource[]
}

export function generateSchedulingPhase(input: SchedulingPhaseInput): SimMessage[] {
  const { podName, namespace, t, nodeResources } = input

  const nodeNames = nodeResources.map((n) => n.name)

  return [
    makeMessage(
      {
        from: 'etcd',
        to: 'scheduler',
        phase: 'scheduling',
        type: 'WATCH_EVENT_UNSCHEDULED_POD',
        request: { podName, namespace },
        latency: 3,
      },
      t,
    ),
    makeMessage(
      {
        from: 'scheduler',
        to: 'scheduler',
        phase: 'scheduling',
        type: 'FILTER_NODES',
        request: { podName, candidates: nodeNames },
        response: { feasible: nodeNames },
        latency: 15,
      },
      t,
    ),
    makeMessage(
      {
        from: 'scheduler',
        to: 'scheduler',
        phase: 'scheduling',
        type: 'SCORE_NODES',
        request: { podName, candidates: nodeNames },
        response: {
          scores: [
            { node: 'node-1', score: 65 },
            { node: 'node-2', score: 42 },
          ],
          selectedNode: 'node-1',
        },
        latency: 20,
      },
      t,
    ),
    makeMessage(
      {
        from: 'scheduler',
        to: 'api-server',
        phase: 'scheduling',
        type: 'BIND_POD',
        request: { podName, namespace, node: 'node-1' },
        response: { bound: true },
        latency: 8,
      },
      t,
    ),
    makeMessage(
      {
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
      },
      t,
    ),
  ]
}
