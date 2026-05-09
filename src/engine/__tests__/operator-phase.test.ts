import { generateOperatorPhase } from '../phases/operator'
import { createRegistryWithBuiltins } from '../operators'
import type { SimMessage } from '../../types/simulation'

function makeT() {
  const ts = Date.now()
  let offset = 0
  return () => ts + offset++
}

describe('generateOperatorPhase', () => {
  it('produces no messages for Pod resource', () => {
    const registry = createRegistryWithBuiltins()
    const messages = generateOperatorPhase({
      podSpec: {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'my-pod', namespace: 'default' },
        spec: { containers: [{ name: 'main', image: 'nginx' }] },
      },
      podName: 'my-pod',
      namespace: 'default',
      operators: [],
      customResources: {},
      nodeNames: ['node-1', 'node-2'],
      t: makeT(),
    }, registry)
    expect(messages).toHaveLength(0)
  })

  it('produces messages for Deployment resource', () => {
    const registry = createRegistryWithBuiltins()
    const messages = generateOperatorPhase({
      podSpec: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'nginx-deploy', namespace: 'default' },
        spec: { replicas: 2, selector: { matchLabels: { app: 'nginx' } } },
      },
      podName: 'nginx-deploy',
      namespace: 'default',
      operators: registry.getAll().map((c) => c.config),
      customResources: {},
      nodeNames: ['node-1', 'node-2'],
      t: makeT(),
    }, registry)

    expect(messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => m.type === 'RECONCILE_TRIGGERED')).toBe(true)
    expect(messages.some((m) => m.type === 'CREATE_RESOURCE')).toBe(true)
  })

  it('chains: Deployment -> ReplicaSet -> Pods', () => {
    const registry = createRegistryWithBuiltins()
    const messages = generateOperatorPhase({
      podSpec: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'nginx-deploy', namespace: 'default' },
        spec: { replicas: 1, selector: { matchLabels: { app: 'nginx' } } },
      },
      podName: 'nginx-deploy',
      namespace: 'default',
      operators: registry.getAll().map((c) => c.config),
      customResources: {},
      nodeNames: ['node-1', 'node-2'],
      t: makeT(),
    }, registry)

    // Should have CREATE_RESOURCE for both ReplicaSet and Pod
    expect(
      messages.some(
        (m) => m.type === 'CREATE_RESOURCE' && (m.request as Record<string, unknown>).kind === 'ReplicaSet',
      ),
    ).toBe(true)
    expect(
      messages.some(
        (m) => m.type === 'CREATE_RESOURCE' && (m.request as Record<string, unknown>).kind === 'Pod',
      ),
    ).toBe(true)
  })

  it('respects chain depth limit', () => {
    const registry = createRegistryWithBuiltins()
    const messages = generateOperatorPhase({
      podSpec: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'nginx-deploy', namespace: 'default' },
        spec: { replicas: 5, selector: { matchLabels: { app: 'nginx' } } },
      },
      podName: 'nginx-deploy',
      namespace: 'default',
      operators: registry.getAll().map((c) => c.config),
      customResources: {},
      nodeNames: ['node-1', 'node-2'],
      t: makeT(),
    }, registry)
    // Should finish without infinite loop
    expect(messages.length).toBeGreaterThan(0)
  })
})
