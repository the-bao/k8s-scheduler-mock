import { CronJobController } from '../operators/cronjob'
import type { ReconcileEvent } from '../../types/simulation'

describe('CronJobController', () => {
  const ctrl = new CronJobController()

  it('has name cronjob-controller', () => {
    expect(ctrl.name).toBe('cronjob-controller')
  })

  it('watches cronjobs', () => {
    expect(ctrl.config.spec.watchResources).toContain('cronjobs')
  })

  it('triggers Job creation via CRON_TRIGGERED', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1', kind: 'CronJob',
        metadata: { name: 'hello-cron', namespace: 'default' },
        spec: {
          schedule: '*/1 * * * *',
          jobTemplate: { spec: { template: { spec: { containers: [{ name: 'hello', image: 'busybox' }] } } } },
        },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    expect(results.some(r => r.messages.some(m => m.type === 'CRON_TRIGGERED'))).toBe(true)
    expect(results.some(r => r.resourceChanges.created?.kind === 'Job')).toBe(true)
  })

  it('created Job name matches pattern', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1', kind: 'CronJob',
        metadata: { name: 'hello-cron', namespace: 'default' },
        spec: {
          schedule: '*/1 * * * *',
          jobTemplate: { spec: { template: { spec: { containers: [{ name: 'hello', image: 'busybox' }] } } } },
        },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const job = results.find(r => r.resourceChanges.created?.kind === 'Job')
    expect(job?.resourceChanges.created?.metadata.name).toMatch(/^hello-cron-\d+$/)
  })
})
