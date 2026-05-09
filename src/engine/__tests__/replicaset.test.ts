import { describe, it, expect, beforeEach } from 'vitest'
import { ReplicaSetController } from '../operators/replicaset'
import { resetMsgCounter } from '../types'
import type { ReconcileEvent } from '../../types/simulation'

describe('ReplicaSetController', () => {
  beforeEach(() => {
    resetMsgCounter()
  })

  const ctrl = new ReplicaSetController()

  it('has name replicaset-controller', () => {
    expect(ctrl.name).toBe('replicaset-controller')
  })

  it('watches replicasets', () => {
    expect(ctrl.config.spec.watchResources).toContain('replicasets')
  })

  it('reconciles Added: creates N Pods', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1', kind: 'ReplicaSet',
        metadata: { name: 'nginx-abc123', namespace: 'default' },
        spec: { replicas: 3, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const pods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    expect(pods).toHaveLength(3)
  })

  it('each Pod has unique name', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1', kind: 'ReplicaSet',
        metadata: { name: 'nginx-abc123', namespace: 'default' },
        spec: { replicas: 2, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const names = results.filter(r => r.resourceChanges.created?.kind === 'Pod').map(r => r.resourceChanges.created!.metadata.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
