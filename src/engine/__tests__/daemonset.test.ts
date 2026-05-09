import { DaemonSetController } from '../operators/daemonset'
import type { ReconcileEvent } from '../../types/simulation'

describe('DaemonSetController', () => {
  const ctrl = new DaemonSetController()

  it('has name daemonset-controller', () => {
    expect(ctrl.name).toBe('daemonset-controller')
  })

  it('watches daemonsets', () => {
    expect(ctrl.config.spec.watchResources).toContain('daemonsets')
  })

  it('creates one Pod per node', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1', kind: 'DaemonSet',
        metadata: { name: 'fluentd', namespace: 'kube-system' },
        spec: { selector: { matchLabels: { app: 'fluentd' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event, ['node-1', 'node-2'])
    const pods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    expect(pods).toHaveLength(2)
  })

  it('assigns node to each Pod', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1', kind: 'DaemonSet',
        metadata: { name: 'fluentd', namespace: 'kube-system' },
        spec: { selector: { matchLabels: { app: 'fluentd' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event, ['node-1', 'node-2'])
    const nodeNames = results.filter(r => r.resourceChanges.created?.kind === 'Pod').map(r => r.resourceChanges.created!.spec.nodeName)
    expect(nodeNames).toContain('node-1')
    expect(nodeNames).toContain('node-2')
  })
})
