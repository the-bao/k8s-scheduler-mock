import type {
  Controller,
  OperatorConfig,
  ReconcileEvent,
  ReconcileResult,
  CustomResource,
} from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

function randomSuffix(length = 5): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export class ReplicaSetController implements Controller {
  readonly name = 'replicaset-controller'

  readonly config: OperatorConfig = {
    apiVersion: 'sim.k8s.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'replicaset-controller',
      managedCRD: {
        group: 'apps',
        version: 'v1',
        kind: 'ReplicaSet',
        plural: 'replicasets',
        scope: 'Namespaced',
        versions: [],
      },
    },
    spec: {
      watchResources: ['replicasets'],
      reconcile: [],
    },
    ui: {
      icon: 'layers',
      color: '#3b82f6',
      position: 'right',
    },
  }

  reconcile(event: ReconcileEvent): ReconcileResult[] {
    if (event.eventType !== 'Added') {
      return []
    }

    const { t } = createTimestampFactory()
    const resource = event.resource
    const rsName = (resource.metadata as Record<string, unknown>)?.name as string
    const namespace = (resource.metadata as Record<string, unknown>)?.namespace as string
    const spec = resource.spec as Record<string, unknown> | undefined
    const replicas = (spec?.replicas as number) ?? 1
    const selector = spec?.selector as Record<string, unknown> | undefined
    const matchLabels = (selector?.matchLabels ?? {}) as Record<string, string>

    const results: ReconcileResult[] = []

    for (let i = 0; i < replicas; i++) {
      const podName = `${rsName}-${randomSuffix()}`

      const triggerMsg = makeMessage(
        {
          from: this.name,
          to: this.name,
          phase: 'operator',
          type: 'RECONCILE_TRIGGERED',
          request: { resource: rsName, kind: 'ReplicaSet' },
          latency: 1,
        },
        t,
      )

      const createMsg = makeMessage(
        {
          from: this.name,
          to: 'api-server',
          phase: 'operator',
          type: 'CREATE_RESOURCE',
          request: { kind: 'Pod', name: podName, namespace },
          latency: 2,
        },
        t,
      )

      const pod: CustomResource = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: podName,
          namespace,
          labels: { ...matchLabels, 'pod-template-hash': rsName.split('-').pop() ?? '' },
        },
        spec: { containers: [] },
        status: { phase: 'Pending' },
      }

      results.push({
        messages: [triggerMsg, createMsg],
        resourceChanges: { created: pod },
      })
    }

    return results
  }
}
