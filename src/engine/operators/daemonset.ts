import type {
  Controller,
  OperatorConfig,
  ReconcileEvent,
  ReconcileResult,
  CustomResource,
} from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

export class DaemonSetController implements Controller {
  name = 'daemonset-controller'
  config: OperatorConfig = {
    apiVersion: 'apps/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'daemonset-controller',
      managedCRD: {
        group: 'apps',
        version: 'v1',
        kind: 'DaemonSet',
        plural: 'daemonsets',
        scope: 'Namespaced',
        versions: [],
      },
    },
    spec: {
      watchResources: ['daemonsets'],
      reconcile: [],
    },
    ui: { icon: 'DS', color: '#6c757d', position: 'left' },
  }

  reconcile(event: ReconcileEvent, nodeNames?: string[]): ReconcileResult[] {
    const nodes = nodeNames ?? ['node-1', 'node-2']

    if (event.eventType !== 'Added') {
      return []
    }

    const dsMeta = event.resource.metadata as { name: string; namespace: string }
    const { t } = createTimestampFactory()
    const results: ReconcileResult[] = []

    const triggerMsg = makeMessage(
      {
        from: 'controller-manager',
        to: 'daemonset-controller',
        phase: 'operator',
        type: 'RECONCILE_TRIGGERED',
        request: { daemonset: dsMeta.name },
        latency: 1,
      },
      t,
    )

    for (const nodeName of nodes) {
      const podName = `${dsMeta.name}-${nodeName}`

      const pod: CustomResource = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: podName,
          namespace: dsMeta.namespace,
        },
        spec: {
          nodeName,
          containers: [],
        },
        status: {},
      }

      const createMsg = makeMessage(
        {
          from: 'daemonset-controller',
          to: 'api-server',
          phase: 'operator',
          type: 'CREATE_RESOURCE',
          request: { pod: podName, node: nodeName },
          latency: 1,
        },
        t,
      )

      results.push({
        messages: [triggerMsg, createMsg],
        resourceChanges: { created: pod },
      })
    }

    return results
  }
}
