import { describe, it, expect, beforeEach } from 'vitest'
import { DeploymentController } from '../operators/deployment'
import { resetMsgCounter } from '../types'
import type { ReconcileEvent } from '../../types/simulation'

describe('DeploymentController', () => {
  beforeEach(() => {
    resetMsgCounter()
  })

  const ctrl = new DeploymentController()

  it('has name deployment-controller', () => {
    expect(ctrl.name).toBe('deployment-controller')
  })

  it('watches deployments', () => {
    expect(ctrl.config.spec.watchResources).toContain('deployments')
  })

  it('reconciles Added: creates ReplicaSet', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1', kind: 'Deployment',
        metadata: { name: 'nginx', namespace: 'default' },
        spec: { replicas: 3, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some(r => r.messages.some(m => m.type === 'RECONCILE_TRIGGERED'))).toBe(true)
    expect(results.some(r => r.resourceChanges.created?.kind === 'ReplicaSet')).toBe(true)
  })

  it('created ReplicaSet has correct replicas', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1', kind: 'Deployment',
        metadata: { name: 'nginx', namespace: 'default' },
        spec: { replicas: 3, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const rs = results.find(r => r.resourceChanges.created?.kind === 'ReplicaSet')
    expect(rs?.resourceChanges.created?.spec.replicas).toBe(3)
  })

  it('messages have operator phase', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1', kind: 'Deployment',
        metadata: { name: 'nginx', namespace: 'default' },
        spec: { replicas: 1, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    for (const r of results) for (const m of r.messages) expect(m.phase).toBe('operator')
  })

  it('sends UPDATE_STATUS', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1', kind: 'Deployment',
        metadata: { name: 'nginx', namespace: 'default' },
        spec: { replicas: 1, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    expect(results.some(r => r.messages.some(m => m.type === 'UPDATE_STATUS'))).toBe(true)
  })
})
