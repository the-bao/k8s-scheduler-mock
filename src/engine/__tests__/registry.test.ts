import { describe, it, expect } from 'vitest'
import { ControllerRegistry } from '../operators/registry'
import type { Controller, ReconcileEvent, ReconcileResult } from '../../types/simulation'

function makeMockController(name: string, watchKinds: string[]): Controller {
  return {
    name,
    config: {
      apiVersion: 'sim.k8s.io/v1',
      kind: 'OperatorConfig' as const,
      metadata: {
        name,
        managedCRD: {
          group: 'apps',
          version: 'v1',
          kind: watchKinds[0] ?? 'Test',
          plural: 'tests',
          scope: 'Namespaced' as const,
          versions: [],
        },
      },
      spec: { watchResources: watchKinds, reconcile: [] },
      ui: { icon: 'cog', color: '#fff', position: 'right' as const },
    },
    reconcile(_event: ReconcileEvent): ReconcileResult[] {
      return [
        {
          messages: [],
          resourceChanges: {
            created: {
              apiVersion: 'v1',
              kind: 'Pod',
              metadata: { name: `${name}-pod`, namespace: 'default' },
              spec: {},
              status: {},
            },
          },
        },
      ]
    },
  }
}

describe('ControllerRegistry', () => {
  it('registers and retrieves controllers', () => {
    const registry = new ControllerRegistry()
    const ctrl = makeMockController('test-ctrl', ['Test'])
    registry.register(ctrl)
    expect(registry.get('test-ctrl')).toBe(ctrl)
  })

  it('returns undefined for unknown controller', () => {
    const registry = new ControllerRegistry()
    expect(registry.get('unknown')).toBeUndefined()
  })

  it('finds controllers watching a resource kind', () => {
    const registry = new ControllerRegistry()
    const ctrl1 = makeMockController('ctrl-1', ['Deployment'])
    const ctrl2 = makeMockController('ctrl-2', ['ReplicaSet'])
    registry.register(ctrl1)
    registry.register(ctrl2)
    expect(registry.findWatching('Deployment')).toEqual([ctrl1])
    expect(registry.findWatching('ReplicaSet')).toEqual([ctrl2])
  })

  it('returns all registered controllers', () => {
    const registry = new ControllerRegistry()
    registry.register(makeMockController('a', ['A']))
    registry.register(makeMockController('b', ['B']))
    expect(registry.getAll()).toHaveLength(2)
  })

  it('unregisters a controller', () => {
    const registry = new ControllerRegistry()
    registry.register(makeMockController('a', ['A']))
    registry.unregister('a')
    expect(registry.getAll()).toHaveLength(0)
  })
})
