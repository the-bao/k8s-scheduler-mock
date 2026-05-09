import type { Controller, ReconcileEvent, ReconcileResult, CustomResource, OperatorConfig } from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

function randomSuffix(length = 5): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export class JobController implements Controller {
  readonly name = 'job-controller'
  readonly config: OperatorConfig = {
    apiVersion: 'k8s-scheduler.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'job-controller',
      managedCRD: {
        group: 'batch',
        version: 'v1',
        kind: 'Job',
        plural: 'jobs',
        scope: 'Namespaced',
        versions: [],
      },
    },
    spec: {
      watchResources: ['jobs'],
      reconcile: [],
    },
    ui: { icon: 'job', color: '#4CAF50', position: 'left' },
  }

  reconcile(event: ReconcileEvent): ReconcileResult[] {
    if (event.eventType !== 'Added') {
      return []
    }

    const { t } = createTimestampFactory()
    const resource = event.resource
    const meta = resource.metadata as { name: string; namespace: string } | undefined
    const spec = resource.spec as {
      completions?: number
      parallelism?: number
      template: { spec: Record<string, unknown> }
    } | undefined

    if (!meta || !spec) {
      return []
    }

    const completions = spec.completions ?? 1
    const parallelism = spec.parallelism ?? completions
    const podCount = Math.min(completions, parallelism)

    const results: ReconcileResult[] = []

    for (let i = 0; i < podCount; i++) {
      const podName = `${meta.name}-${randomSuffix()}`
      const podResource: CustomResource = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: podName,
          namespace: meta.namespace,
          labels: { 'job-name': meta.name },
        },
        spec: spec.template.spec,
        status: { phase: 'Pending' },
      }

      results.push({
        messages: [
          makeMessage(
            {
              from: 'controller-manager',
              to: 'api-server',
              phase: 'controller',
              type: 'CREATE_RESOURCE',
              request: { kind: 'Pod', name: podName, namespace: meta.namespace },
              latency: 5,
            },
            t,
          ),
        ],
        resourceChanges: { created: podResource },
      })
    }

    // Add UPDATE_STATUS message on the last result
    const lastResult = results[results.length - 1]
    if (lastResult) {
      lastResult.messages.push(
        makeMessage(
          {
            from: 'controller-manager',
            to: 'api-server',
            phase: 'controller',
            type: 'UPDATE_STATUS',
            request: {
              kind: 'Job',
              name: meta.name,
              namespace: meta.namespace,
              status: { active: podCount, succeeded: 0, failed: 0 },
            },
            latency: 3,
          },
          t,
        ),
      )
    }

    return results
  }
}
