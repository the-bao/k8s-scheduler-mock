import { JobController } from '../operators/job'
import type { ReconcileEvent } from '../../types/simulation'

describe('JobController', () => {
  const ctrl = new JobController()

  it('has name job-controller', () => {
    expect(ctrl.name).toBe('job-controller')
  })

  it('watches jobs', () => {
    expect(ctrl.config.spec.watchResources).toContain('jobs')
  })

  it('creates Pods based on min(completions, parallelism)', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1', kind: 'Job',
        metadata: { name: 'batch-job', namespace: 'default' },
        spec: { completions: 3, parallelism: 1, template: { spec: { containers: [{ name: 'worker', image: 'busybox' }] } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const pods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    expect(pods).toHaveLength(1) // min(3, 1) = 1
  })

  it('defaults to 1 completion if not specified', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1', kind: 'Job',
        metadata: { name: 'simple-job', namespace: 'default' },
        spec: { template: { spec: { containers: [{ name: 'worker', image: 'busybox' }] } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const pods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    expect(pods).toHaveLength(1)
  })

  it('sends UPDATE_STATUS for job', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1', kind: 'Job',
        metadata: { name: 'batch-job', namespace: 'default' },
        spec: { completions: 2, parallelism: 2, template: { spec: { containers: [{ name: 'worker', image: 'busybox' }] } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    expect(results.some(r => r.messages.some(m => m.type === 'UPDATE_STATUS'))).toBe(true)
  })
})
