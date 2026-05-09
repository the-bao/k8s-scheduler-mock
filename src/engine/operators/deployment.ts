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

export class DeploymentController implements Controller {
  readonly name = 'deployment-controller'

  readonly config: OperatorConfig = {
    apiVersion: 'sim.k8s.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'deployment-controller',
      managedCRD: {
        group: 'apps',
        version: 'v1',
        kind: 'Deployment',
        plural: 'deployments',
        scope: 'Namespaced',
        versions: [],
      },
    },
    spec: {
      watchResources: ['deployments', 'replicasets'],
      reconcile: [],
    },
    ui: {
      icon: 'rocket',
      color: '#8b5cf6',
      position: 'right',
    },
  }

  reconcile(event: ReconcileEvent): ReconcileResult[] {
    if (event.eventType !== 'Added') {
      return []
    }

    const { t } = createTimestampFactory()
    const resource = event.resource
    const deployName = (resource.metadata as Record<string, unknown>)?.name as string
    const namespace = (resource.metadata as Record<string, unknown>)?.namespace as string
    const spec = resource.spec as Record<string, unknown> | undefined
    const replicas = (spec?.replicas as number) ?? 1
    const selector = spec?.selector as Record<string, unknown> | undefined

    const results: ReconcileResult[] = []

    // Message 1: RECONCILE_TRIGGERED
    const reconcileMsg = makeMessage(
      {
        from: this.name,
        to: this.name,
        phase: 'operator',
        type: 'RECONCILE_TRIGGERED',
        request: { resource: deployName, kind: 'Deployment' },
        latency: 1,
      },
      t,
    )

    // Message 2: CALCULATE_DIFF
    const diffMsg = makeMessage(
      {
        from: this.name,
        to: this.name,
        phase: 'operator',
        type: 'CALCULATE_DIFF',
        request: { resource: deployName, kind: 'Deployment', desiredReplicas: replicas },
        latency: 1,
      },
      t,
    )

    // Create the ReplicaSet
    const suffix = randomSuffix()
    const rsName = `${deployName}-${suffix}`

    // Message 3: CREATE_RESOURCE
    const createMsg = makeMessage(
      {
        from: this.name,
        to: 'api-server',
        phase: 'operator',
        type: 'CREATE_RESOURCE',
        request: { kind: 'ReplicaSet', name: rsName, namespace },
        latency: 2,
      },
      t,
    )

    const replicaSet: CustomResource = {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: {
        name: rsName,
        namespace,
      },
      spec: {
        replicas,
        selector,
      },
      status: { replicas: 0, readyReplicas: 0, availableReplicas: 0 },
    }

    // Message 4: UPDATE_STATUS
    const statusMsg = makeMessage(
      {
        from: this.name,
        to: 'api-server',
        phase: 'operator',
        type: 'UPDATE_STATUS',
        request: {
          resource: deployName,
          kind: 'Deployment',
          status: { replicas, readyReplicas: 0, updatedReplicas: replicas, availableReplicas: 0 },
        },
        latency: 1,
      },
      t,
    )

    results.push({
      messages: [reconcileMsg, diffMsg, createMsg, statusMsg],
      resourceChanges: { created: replicaSet },
    })

    return results
  }
}
