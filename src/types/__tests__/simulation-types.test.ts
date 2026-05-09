import type {
  Phase,
  CRDSpec,
  CRDVersion,
  ReconcileRule,
  ReconcileAction,
  OperatorConfig,
  StatusConditionDef,
  CustomResource,
  Controller,
  ReconcileEvent,
  ReconcileResult,
} from '../simulation'
import type { ResourceStore, Scenario } from '../simulation'

describe('Operator type exports', () => {
  it('Phase includes operator', () => {
    const phase: Phase = 'operator'
    expect(phase).toBe('operator')
  })

  it('CRDSpec is a valid type', () => {
    const crd: CRDSpec = {
      group: 'apps',
      version: 'v1',
      kind: 'Deployment',
      plural: 'deployments',
      scope: 'Namespaced',
      versions: [{ name: 'v1', served: true, storage: true, schema: {} }],
    }
    expect(crd.kind).toBe('Deployment')
  })

  it('ReconcileRule accepts Added event', () => {
    const rule: ReconcileRule = {
      watchResource: 'deployments',
      onEvent: 'Added',
      actions: [],
    }
    expect(rule.onEvent).toBe('Added')
  })

  it('ReconcileAction covers all CRUD types', () => {
    const types: ReconcileAction['type'][] = [
      'createResource', 'updateResource', 'deleteResource', 'updateStatus', 'sendEvent',
    ]
    expect(types).toHaveLength(5)
  })

  it('OperatorConfig has managedCRD', () => {
    const op: OperatorConfig = {
      apiVersion: 'sim.k8s.io/v1',
      kind: 'OperatorConfig',
      metadata: { name: 'test-op', managedCRD: { group: 'apps', version: 'v1', kind: 'Test', plural: 'tests', scope: 'Namespaced', versions: [] } },
      spec: { watchResources: ['tests'], reconcile: [] },
      ui: { icon: 'cog', color: '#fff', position: 'right' },
    }
    expect(op.metadata.managedCRD.kind).toBe('Test')
  })

  it('CustomResource has spec and status', () => {
    const cr: CustomResource = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'my-deploy', namespace: 'default', uid: 'uid-1' },
      spec: { replicas: 3 },
      status: { readyReplicas: 2 },
    }
    expect(cr.spec.replicas).toBe(3)
  })

  it('ResourceStore includes customResources', () => {
    const store: ResourceStore = {
      pods: {},
      nodes: {},
      pvcs: {},
      configmaps: {},
      customResources: {},
    }
    expect(store.customResources).toEqual({})
  })

  it('Scenario has optional resourceType and operators', () => {
    const scenario: Scenario = {
      id: 'deploy-normal',
      name: 'Normal Deployment',
      description: 'test',
      podYaml: {},
      resourceType: 'Deployment',
      operators: ['deployment-controller'],
    }
    expect(scenario.resourceType).toBe('Deployment')
  })
})
