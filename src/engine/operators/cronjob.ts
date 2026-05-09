import type { Controller, ReconcileEvent, ReconcileResult, CustomResource, OperatorConfig } from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

export class CronJobController implements Controller {
  readonly name = 'cronjob-controller'
  readonly config: OperatorConfig = {
    apiVersion: 'k8s-scheduler.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'cronjob-controller',
      managedCRD: {
        group: 'batch',
        version: 'v1',
        kind: 'CronJob',
        plural: 'cronjobs',
        scope: 'Namespaced',
        versions: [],
      },
    },
    spec: {
      watchResources: ['cronjobs'],
      reconcile: [],
    },
    ui: { icon: 'cronjob', color: '#FF9800', position: 'left' },
  }

  reconcile(event: ReconcileEvent): ReconcileResult[] {
    if (event.eventType !== 'Added') {
      return []
    }

    const { t } = createTimestampFactory()
    const resource = event.resource
    const meta = resource.metadata as { name: string; namespace: string } | undefined
    const spec = resource.spec as {
      schedule: string
      jobTemplate: { spec: Record<string, unknown> }
    } | undefined

    if (!meta || !spec) {
      return []
    }

    const jobName = `${meta.name}-${Date.now()}`
    const jobResource: CustomResource = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: jobName,
        namespace: meta.namespace,
        labels: { 'cronjob-name': meta.name },
      },
      spec: spec.jobTemplate.spec,
      status: { active: 1, succeeded: 0, failed: 0 },
    }

    return [
      {
        messages: [
          makeMessage(
            {
              from: this.name,
              to: 'api-server',
              phase: 'operator',
              type: 'CRON_TRIGGERED',
              request: {
                kind: 'CronJob',
                name: meta.name,
                namespace: meta.namespace,
                schedule: spec.schedule,
              },
              latency: 2,
            },
            t,
          ),
          makeMessage(
            {
              from: this.name,
              to: 'api-server',
              phase: 'operator',
              type: 'CREATE_RESOURCE',
              request: {
                kind: 'Job',
                name: jobName,
                namespace: meta.namespace,
                ownerReference: { kind: 'CronJob', name: meta.name },
              },
              latency: 5,
            },
            t,
          ),
        ],
        resourceChanges: { created: jobResource },
      },
    ]
  }
}
