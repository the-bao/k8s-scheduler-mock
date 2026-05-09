# Operator Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete Operator framework with 5 built-in controllers (Deployment, ReplicaSet, DaemonSet, Job, CronJob), CRD support, reconcile loop simulation, and Flow canvas visualization.

**Architecture:** New `OperatorConfig` type alongside existing `PluginConfig`. Engine split into phase modules under `src/engine/phases/`. Controllers under `src/engine/operators/` implementing a unified `Controller` interface. New `operator` phase between `controller` and `scheduling`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest (new), Zustand 5, React Flow, js-yaml, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-05-09-operator-framework-design.md`

---

## File Structure

### New files
- `vitest.config.ts` — test runner config
- `src/engine/types.ts` — shared engine types (Controller, ReconcileEvent, ReconcileResult, etc.)
- `src/engine/phases/submit.ts` — Phase 1 extracted from simulation.ts
- `src/engine/phases/controller.ts` — Phase 2 extracted from simulation.ts
- `src/engine/phases/operator.ts` — Phase 3 new, orchestrates controller reconcile
- `src/engine/phases/scheduling.ts` — Phase 4 extracted from simulation.ts
- `src/engine/phases/kubelet.ts` — Phase 5 extracted from simulation.ts
- `src/engine/phases/index.ts` — re-exports all phase generators
- `src/engine/operators/registry.ts` — Controller registry + chain orchestration
- `src/engine/operators/deployment.ts` — Deployment Controller
- `src/engine/operators/replicaset.ts` — ReplicaSet Controller
- `src/engine/operators/daemonset.ts` — DaemonSet Controller
- `src/engine/operators/job.ts` — Job Controller
- `src/engine/operators/cronjob.ts` — CronJob Controller
- `src/engine/operators/index.ts` — re-exports + built-in loading
- `src/engine/template.ts` — {{variable}} resolution
- `src/engine/__tests__/template.test.ts`
- `src/engine/__tests__/registry.test.ts`
- `src/engine/__tests__/deployment.test.ts`
- `src/engine/__tests__/replicaset.test.ts`
- `src/engine/__tests__/daemonset.test.ts`
- `src/engine/__tests__/job.test.ts`
- `src/engine/__tests__/cronjob.test.ts`
- `src/engine/__tests__/operator-phase.test.ts`

### Modified files
- `src/types/simulation.ts` — add OperatorConfig, CRDSpec, ReconcileRule, CustomResource, extend Phase, ResourceStore, Scenario
- `src/engine/simulation.ts` — refactor to use phase modules, accept operators param
- `src/store/simulation-store.ts` — add operators, customResources, updated startSimulation
- `src/components/canvas/node-layout.ts` — add controller node positions + dynamic edges
- `src/components/canvas/FlowCanvas.tsx` — use dynamic edges from store
- `src/components/canvas/K8sNode.tsx` — add operator node colors
- `src/components/timeline/Timeline.tsx` — add 'operator' to phase colors + labels
- `src/components/toolbar/PluginEditor.tsx` — dual-mode with Operator tab
- `src/components/toolbar/Toolbar.tsx` — grouped scenario selector, dynamic button text
- `src/components/detail/DetailPanel.tsx` — show CRD resources in status tab
- `src/data/scenarios.ts` — add Operator fault scenarios + resourceType field

---

### Task 1: Set up Vitest testing infrastructure

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add devDependency + test script)

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify test runner works**

Run: `npx vitest run`
Expected: passes (no tests yet, exits 0)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest testing infrastructure"
```

---

### Task 2: Add new types to simulation.ts

**Files:**
- Modify: `src/types/simulation.ts`

- [ ] **Step 1: Write the failing test**

Create `src/types/__tests__/simulation-types.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/__tests__/simulation-types.test.ts`
Expected: FAIL — types not exported

- [ ] **Step 3: Add types to simulation.ts**

Add to `src/types/simulation.ts` after the existing types:

```typescript
// ── Operator Framework types ──────────────────────────────────────────

export type Phase = 'submit' | 'controller' | 'operator' | 'scheduling' | 'kubelet' | 'completed'
```

Replace the existing `Phase` type (line 3) with the above.

Add after `SimNode` interface:
```typescript
// CRD Definition
export interface CRDSpec {
  group: string
  version: string
  kind: string
  plural: string
  scope: 'Namespaced' | 'Cluster'
  versions: CRDVersion[]
}

export interface CRDVersion {
  name: string
  served: boolean
  storage: boolean
  schema: Record<string, unknown>
}

// Reconcile Rules
export interface ReconcileRule {
  watchResource: string
  labelSelector?: Record<string, string>
  onEvent: 'Added' | 'Modified' | 'Deleted'
  condition?: string
  actions: ReconcileAction[]
}

export interface ReconcileAction {
  type: 'createResource' | 'updateResource' | 'deleteResource' | 'updateStatus' | 'sendEvent'
  target?: {
    apiVersion: string
    kind: string
    name?: string
    namespace?: string
  }
  template?: Record<string, unknown>
  patch?: Record<string, unknown>
  error?: { code: number; message: string; retryable: boolean }
}

// Operator Config
export interface OperatorConfig {
  apiVersion: string
  kind: 'OperatorConfig'
  metadata: {
    name: string
    managedCRD: CRDSpec
  }
  spec: {
    watchResources: string[]
    reconcile: ReconcileRule[]
    statusConditions?: StatusConditionDef[]
  }
  ui: PluginUI
}

export interface StatusConditionDef {
  type: string
  reason: string
  message: string
  targetStatus: string
}

// Custom Resource
export interface CustomResource {
  apiVersion: string
  kind: string
  metadata: { name: string; namespace: string; uid?: string }
  spec: Record<string, unknown>
  status: Record<string, unknown>
}

// Controller Interface
export interface Controller {
  name: string
  config: OperatorConfig
  reconcile(event: ReconcileEvent): ReconcileResult[]
}

export interface ReconcileEvent {
  eventType: 'Added' | 'Modified' | 'Deleted'
  resource: Record<string, unknown>
  existingResources: CustomResource[]
}

export interface ReconcileResult {
  messages: SimMessage[]
  resourceChanges: { created?: CustomResource; updated?: CustomResource; deleted?: string }
}
```

Update `ResourceStore` (line 47) to add `customResources`:
```typescript
export interface ResourceStore {
  pods: Record<string, PodResource>
  nodes: Record<string, NodeResource>
  pvcs: Record<string, PVCResource>
  configmaps: Record<string, Record<string, unknown>>
  customResources: Record<string, Record<string, CustomResource>>
}
```

Update `Scenario` (line 147) to add optional fields:
```typescript
export interface Scenario {
  id: string
  name: string
  description: string
  podYaml: Record<string, unknown>
  injectErrors?: { phase: Phase; messageType: string; error: SimError }[]
  resourceType?: 'Pod' | 'Deployment' | 'DaemonSet' | 'Job' | 'CronJob'
  operators?: string[]
}
```

- [ ] **Step 4: Update engine/simulation.ts getDefaultResources to include customResources**

In `getDefaultResources()` (line 400), add `customResources: {}` to the return object.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/types/__tests__/simulation-types.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/simulation.ts src/types/__tests__/simulation-types.test.ts src/engine/simulation.ts
git commit -m "feat: add Operator framework types (CRDSpec, ReconcileRule, OperatorConfig, Controller)"
```

---

### Task 3: Create template variable resolver

**Files:**
- Create: `src/engine/template.ts`
- Create: `src/engine/__tests__/template.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { resolveTemplate, resolvePath } from '../template'

describe('resolvePath', () => {
  it('extracts nested value from object', () => {
    expect(resolvePath({ spec: { replicas: 3 } }, 'spec.replicas')).toBe(3)
  })

  it('returns undefined for missing path', () => {
    expect(resolvePath({ spec: {} }, 'spec.replicas')).toBeUndefined()
  })

  it('handles single-level path', () => {
    expect(resolvePath({ name: 'test' }, 'name')).toBe('test')
  })
})

describe('resolveTemplate', () => {
  const resource = {
    metadata: { name: 'my-app', namespace: 'default' },
    spec: { replicas: 3, selector: { matchLabels: { app: 'my-app' } } },
  }

  it('replaces {{variable}} in string', () => {
    const result = resolveTemplate('{{metadata.name}}-abc123', resource)
    expect(result).toBe('my-app-abc123')
  })

  it('replaces multiple variables', () => {
    const result = resolveTemplate('{{metadata.namespace}}/{{metadata.name}}', resource)
    expect(result).toBe('default/my-app')
  })

  it('resolves numeric values', () => {
    const result = resolveTemplate('{{spec.replicas}}', resource)
    expect(result).toBe('3')
  })

  it('resolves nested object values', () => {
    const result = resolveTemplate({ name: '{{metadata.name}}', replicas: '{{spec.replicas}}' }, resource)
    expect(result).toEqual({ name: 'my-app', replicas: '3' })
  })

  it('resolves variables in arrays', () => {
    const result = resolveTemplate(['{{metadata.name}}', '{{metadata.namespace}}'], resource)
    expect(result).toEqual(['my-app', 'default'])
  })

  it('returns non-string primitives as-is', () => {
    expect(resolveTemplate(42, resource)).toBe(42)
    expect(resolveTemplate(true, resource)).toBe(true)
    expect(resolveTemplate(null, resource)).toBe(null)
  })

  it('leaves unmatched variables as-is', () => {
    const result = resolveTemplate('{{unknown.path}}', resource)
    expect(result).toBe('{{unknown.path}}')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/template.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement template.ts**

```typescript
export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function resolveTemplate<T>(template: T, resource: Record<string, unknown>): T {
  if (typeof template === 'string') {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const value = resolvePath(resource, path.trim())
      return value !== undefined ? String(value) : `{{${path.trim()}}}`
    }) as T
  }

  if (Array.isArray(template)) {
    return template.map((item) => resolveTemplate(item, resource)) as T
  }

  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
      result[key] = resolveTemplate(value, resource)
    }
    return result as T
  }

  return template
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/template.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/template.ts src/engine/__tests__/template.test.ts
git commit -m "feat: add template variable resolver for Operator reconcile"
```

---

### Task 4: Create engine shared types and message helpers

**Files:**
- Create: `src/engine/types.ts`

- [ ] **Step 1: Create engine/types.ts**

```typescript
import type { SimMessage } from '../types/simulation'

let msgCounter = 0

export function resetMsgCounter(): void {
  msgCounter = 0
}

export function nextMsgId(): string {
  return `msg-${++msgCounter}`
}

export function createTimestampFactory(): { t: () => number; reset: () => void } {
  const ts = Date.now()
  let offset = 0
  return {
    t: () => ts + offset++,
    reset: () => { offset = 0 },
  }
}

export function makeMessage(
  overrides: Omit<SimMessage, 'id' | 'timestamp'>,
  t: () => number,
): SimMessage {
  return {
    id: nextMsgId(),
    timestamp: t(),
    ...overrides,
  }
}

export interface PhaseInput {
  podSpec: Record<string, unknown>
  podName: string
  namespace: string
  t: () => number
}

export interface OperatorPhaseInput extends PhaseInput {
  operators: import('../types/simulation').OperatorConfig[]
  customResources: Record<string, import('../types/simulation').CustomResource>
  nodeNames: string[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: add engine shared types and message helpers"
```

---

### Task 5: Extract submit phase

**Files:**
- Create: `src/engine/phases/submit.ts`
- Modify: `src/engine/simulation.ts` (remove inline submit logic, import from phase)

- [ ] **Step 1: Create src/engine/phases/submit.ts**

```typescript
import type { SimMessage } from '../../types/simulation'
import { makeMessage } from '../types'
import type { PhaseInput } from '../types'

export function generateSubmitPhase(input: PhaseInput): SimMessage[] {
  const { podSpec, podName, namespace, t } = input
  const messages: SimMessage[] = []

  messages.push(makeMessage({
    from: 'user',
    to: 'api-server',
    phase: 'submit',
    type: 'CREATE_POD',
    request: { pod: podSpec },
    latency: 5,
  }, t))

  messages.push(makeMessage({
    from: 'api-server',
    to: 'etcd',
    phase: 'submit',
    type: 'WRITE_POD',
    request: { key: `/registry/pods/${namespace}/${podName}`, value: podSpec },
    latency: 12,
  }, t))

  messages.push(makeMessage({
    from: 'etcd',
    to: 'api-server',
    phase: 'submit',
    type: 'WRITE_POD_RESPONSE',
    request: {},
    response: { revision: 1 },
    latency: 8,
  }, t))

  messages.push(makeMessage({
    from: 'api-server',
    to: 'user',
    phase: 'submit',
    type: 'CREATE_POD_RESPONSE',
    request: {},
    response: { uid: `${namespace}/${podName}`, created: true },
    latency: 3,
  }, t))

  return messages
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/phases/submit.ts
git commit -m "refactor: extract submit phase from simulation engine"
```

---

### Task 6: Extract controller phase

**Files:**
- Create: `src/engine/phases/controller.ts`

- [ ] **Step 1: Create src/engine/phases/controller.ts**

Extract the existing controller-manager watch + operator plugin logic:

```typescript
import type { SimMessage, PluginConfig, PluginAction } from '../../types/simulation'
import { makeMessage } from '../types'
import type { PhaseInput } from '../types'

function buildOperatorPluginMessage(
  plugin: PluginConfig,
  action: PluginAction,
  podName: string,
  namespace: string,
  t: () => number,
): SimMessage {
  return makeMessage({
    from: plugin.metadata.name,
    to: 'api-server',
    phase: 'controller',
    type: `OPERATOR_${action.type.toUpperCase()}`,
    request: {
      action: action.type,
      resource: action.resource ?? { podName, namespace },
      patch: action.patch,
    },
    response: action.error ? undefined : { applied: true },
    error: action.error ? { ...action.error, retryable: false } : undefined,
    latency: 15,
  }, t)
}

export interface ControllerPhaseInput extends PhaseInput {
  plugins: PluginConfig[]
}

export function generateControllerPhase(input: ControllerPhaseInput): SimMessage[] {
  const { podSpec, podName, namespace, plugins, t } = input
  const messages: SimMessage[] = []

  messages.push(makeMessage({
    from: 'etcd',
    to: 'controller-manager',
    phase: 'controller',
    type: 'WATCH_EVENT_POD_ADDED',
    request: { pod: podSpec },
    latency: 2,
  }, t))

  const operatorPlugins = plugins.filter((p) => p.kind === 'OperatorPlugin')
  for (const plugin of operatorPlugins) {
    const rules = plugin.spec.reconcile ?? []
    for (const rule of rules) {
      for (const action of rule.actions) {
        messages.push(buildOperatorPluginMessage(plugin, action, podName, namespace, t))
      }
    }
    if (rules.length === 0 && plugin.spec.actions) {
      for (const action of plugin.spec.actions) {
        messages.push(buildOperatorPluginMessage(plugin, action, podName, namespace, t))
      }
    }
  }

  return messages
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/phases/controller.ts
git commit -m "refactor: extract controller phase from simulation engine"
```

---

### Task 7: Extract scheduling phase

**Files:**
- Create: `src/engine/phases/scheduling.ts`

- [ ] **Step 1: Create src/engine/phases/scheduling.ts**

```typescript
import type { SimMessage, NodeResource } from '../../types/simulation'
import { makeMessage } from '../types'
import type { PhaseInput } from '../types'

export interface SchedulingPhaseInput extends PhaseInput {
  nodeResources: NodeResource[]
}

export function generateSchedulingPhase(input: SchedulingPhaseInput): SimMessage[] {
  const { podName, namespace, nodeResources, t } = input
  const messages: SimMessage[] = []
  const nodeNames = nodeResources.map((n) => n.name)

  messages.push(makeMessage({
    from: 'etcd',
    to: 'scheduler',
    phase: 'scheduling',
    type: 'WATCH_EVENT_UNSCHEDULED_POD',
    request: { podName, namespace },
    latency: 3,
  }, t))

  messages.push(makeMessage({
    from: 'scheduler',
    to: 'scheduler',
    phase: 'scheduling',
    type: 'FILTER_NODES',
    request: { podName, candidates: nodeNames },
    response: { feasible: nodeNames },
    latency: 15,
  }, t))

  messages.push(makeMessage({
    from: 'scheduler',
    to: 'scheduler',
    phase: 'scheduling',
    type: 'SCORE_NODES',
    request: { podName, candidates: nodeNames },
    response: {
      scores: [
        { node: 'node-1', score: 65 },
        { node: 'node-2', score: 42 },
      ],
      selectedNode: 'node-1',
    },
    latency: 20,
  }, t))

  messages.push(makeMessage({
    from: 'scheduler',
    to: 'api-server',
    phase: 'scheduling',
    type: 'BIND_POD',
    request: { podName, namespace, node: 'node-1' },
    response: { bound: true },
    latency: 8,
  }, t))

  messages.push(makeMessage({
    from: 'api-server',
    to: 'etcd',
    phase: 'scheduling',
    type: 'UPDATE_POD_BIND',
    request: {
      key: `/registry/pods/${namespace}/${podName}`,
      patch: { spec: { nodeName: 'node-1' } },
    },
    response: { revision: 2 },
    latency: 10,
  }, t))

  return messages
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/phases/scheduling.ts
git commit -m "refactor: extract scheduling phase from simulation engine"
```

---

### Task 8: Extract kubelet phase

**Files:**
- Create: `src/engine/phases/kubelet.ts`

- [ ] **Step 1: Create src/engine/phases/kubelet.ts**

```typescript
import type { SimMessage } from '../../types/simulation'
import { makeMessage } from '../types'
import type { PhaseInput } from '../types'

export function generateKubeletPhase(input: PhaseInput): SimMessage[] {
  const { podSpec, podName, namespace, t } = input
  const messages: SimMessage[] = []

  messages.push(makeMessage({
    from: 'etcd',
    to: 'kubelet',
    phase: 'kubelet',
    type: 'WATCH_EVENT_POD_BOUND',
    request: { podName, namespace, node: 'node-1' },
    latency: 3,
  }, t))

  messages.push(makeMessage({
    from: 'kubelet',
    to: 'cri',
    phase: 'kubelet',
    type: 'CREATE_SANDBOX',
    request: { podName, namespace },
    response: { sandboxId: 'sandbox-abc123' },
    latency: 120,
  }, t))

  messages.push(makeMessage({
    from: 'kubelet',
    to: 'cni',
    phase: 'kubelet',
    type: 'CNI_SETUP',
    request: { podName, namespace, sandboxId: 'sandbox-abc123' },
    response: { ip: '10.244.1.5' },
    latency: 45,
  }, t))

  messages.push(makeMessage({
    from: 'kubelet',
    to: 'csi',
    phase: 'kubelet',
    type: 'CSI_STAGE_VOLUME',
    request: { podName, volumeId: 'vol-001' },
    response: { staged: true },
    latency: 80,
  }, t))

  messages.push(makeMessage({
    from: 'kubelet',
    to: 'csi',
    phase: 'kubelet',
    type: 'CSI_PUBLISH_VOLUME',
    request: { podName, volumeId: 'vol-001' },
    response: { published: true, targetPath: '/var/lib/kubelet/pods/abc/volumes' },
    latency: 35,
  }, t))

  const containers =
    (podSpec.spec as Record<string, unknown>)?.containers as
      | { name: string; image: string }[]
      | undefined
    ?? [{ name: 'main', image: 'nginx:latest' }]
  const firstContainer = containers[0]

  messages.push(makeMessage({
    from: 'kubelet',
    to: 'cri',
    phase: 'kubelet',
    type: 'PULL_IMAGE',
    request: { image: firstContainer.image },
    response: { imageId: `sha256:${firstContainer.image}` },
    latency: 2500,
  }, t))

  messages.push(makeMessage({
    from: 'kubelet',
    to: 'cri',
    phase: 'kubelet',
    type: 'START_CONTAINER',
    request: {
      podName,
      containerName: firstContainer.name,
      image: firstContainer.image,
    },
    response: { containerId: 'ctr-xyz789' },
    latency: 200,
  }, t))

  messages.push(makeMessage({
    from: 'kubelet',
    to: 'api-server',
    phase: 'kubelet',
    type: 'UPDATE_POD_STATUS',
    request: {
      podName,
      namespace,
      status: { phase: 'Running', podIP: '10.244.1.5' },
    },
    response: { updated: true },
    latency: 10,
  }, t))

  messages.push(makeMessage({
    from: 'api-server',
    to: 'etcd',
    phase: 'kubelet',
    type: 'WRITE_POD_STATUS',
    request: {
      key: `/registry/pods/${namespace}/${podName}`,
      patch: { status: { phase: 'Running', podIP: '10.244.1.5' } },
    },
    response: { revision: 3 },
    latency: 8,
  }, t))

  return messages
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/phases/kubelet.ts
git commit -m "refactor: extract kubelet phase from simulation engine"
```

---

### Task 9: Create phase index and refactor simulation.ts

**Files:**
- Create: `src/engine/phases/index.ts`
- Modify: `src/engine/simulation.ts` — use extracted phases

- [ ] **Step 1: Create src/engine/phases/index.ts**

```typescript
export { generateSubmitPhase } from './submit'
export type { ControllerPhaseInput, generateControllerPhase } from './controller'
export { generateControllerPhase } from './controller'
export type { SchedulingPhaseInput } from './scheduling'
export { generateSchedulingPhase } from './scheduling'
export { generateKubeletPhase } from './kubelet'
```

- [ ] **Step 2: Rewrite simulation.ts to use extracted phases**

Replace the entire content of `src/engine/simulation.ts` with:

```typescript
import type {
  SimMessage,
  SimNode,
  ResourceStore,
  NodeResource,
  PluginConfig,
  Scenario,
} from '../types/simulation'
import { resetMsgCounter, createTimestampFactory } from './types'
import { generateSubmitPhase } from './phases/submit'
import { generateControllerPhase } from './phases/controller'
import { generateSchedulingPhase } from './phases/scheduling'
import { generateKubeletPhase } from './phases/kubelet'

const builtinComponents = [
  'api-server',
  'etcd',
  'controller-manager',
  'scheduler',
  'kubelet',
  'cri',
  'cni',
  'csi',
] as const

const builtinNodes: SimNode[] = builtinComponents.map((c) => ({
  id: c,
  type: 'builtin',
  component: c,
  label: c,
  state: 'idle',
}))

const defaultNodeResources: NodeResource[] = [
  {
    name: 'node-1',
    cpu: { capacity: 8, allocatable: 8, used: 0 },
    memory: { capacity: 32, allocatable: 32, used: 0 },
    labels: { 'kubernetes.io/os': 'linux' },
  },
  {
    name: 'node-2',
    cpu: { capacity: 4, allocatable: 4, used: 0 },
    memory: { capacity: 16, allocatable: 16, used: 0 },
    labels: { 'kubernetes.io/os': 'linux' },
  },
]

export function generateMessages(
  podSpec: Record<string, unknown>,
  plugins: PluginConfig[],
  scenario?: Scenario,
): SimMessage[] {
  resetMsgCounter()
  const { t } = createTimestampFactory()

  const meta = podSpec.metadata as Record<string, unknown> | undefined
  const podName = String(meta?.name ?? 'unknown-pod')
  const namespace = String(meta?.namespace ?? 'default')

  const phaseInput = { podSpec, podName, namespace, t }

  const messages: SimMessage[] = [
    ...generateSubmitPhase(phaseInput),
    ...generateControllerPhase({ ...phaseInput, plugins }),
    ...generateSchedulingPhase({ ...phaseInput, nodeResources: defaultNodeResources }),
    ...generateKubeletPhase(phaseInput),
  ]

  if (scenario?.injectErrors) {
    for (const injection of scenario.injectErrors) {
      const target = messages.find(
        (m) => m.phase === injection.phase && m.type === injection.messageType,
      )
      if (target) {
        target.error = injection.error
      }
    }
  }

  return messages
}

export function getDefaultNodes(): SimNode[] {
  return builtinNodes.map((n) => ({ ...n }))
}

export function getDefaultResources(): ResourceStore {
  const nodes: ResourceStore['nodes'] = {}
  for (const nr of defaultNodeResources) {
    nodes[nr.name] = {
      ...nr,
      cpu: { ...nr.cpu },
      memory: { ...nr.memory },
      labels: { ...nr.labels },
    }
  }
  return {
    pods: {},
    nodes,
    pvcs: {},
    configmaps: {},
    customResources: {},
  }
}
```

- [ ] **Step 3: Verify existing app still works**

Run: `npm run build`
Expected: PASS — no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/engine/phases/index.ts src/engine/simulation.ts
git commit -m "refactor: use extracted phase modules in simulation engine"
```

---

### Task 10: Create Controller registry

**Files:**
- Create: `src/engine/operators/registry.ts`
- Create: `src/engine/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { ControllerRegistry } from '../operators/registry'
import type { OperatorConfig, Controller, ReconcileEvent, ReconcileResult } from '../../types/simulation'

function makeMockController(name: string, watchKinds: string[]): Controller {
  const config: OperatorConfig = {
    apiVersion: 'sim.k8s.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name,
      managedCRD: {
        group: 'apps', version: 'v1', kind: watchKinds[0] ?? 'Test',
        plural: 'tests', scope: 'Namespaced', versions: [],
      },
    },
    spec: { watchResources: watchKinds, reconcile: [] },
    ui: { icon: 'cog', color: '#fff', position: 'right' },
  }
  return {
    name,
    config,
    reconcile(event: ReconcileEvent): ReconcileResult[] {
      return [{
        messages: [],
        resourceChanges: {
          created: {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { name: `${name}-pod`, namespace: 'default' },
            spec: { event: event.eventType },
            status: {},
          },
        },
      }]
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement registry.ts**

```typescript
import type { Controller } from '../../types/simulation'

export class ControllerRegistry {
  private controllers = new Map<string, Controller>()

  register(controller: Controller): void {
    this.controllers.set(controller.name, controller)
  }

  unregister(name: string): void {
    this.controllers.delete(name)
  }

  get(name: string): Controller | undefined {
    return this.controllers.get(name)
  }

  getAll(): Controller[] {
    return [...this.controllers.values()]
  }

  findWatching(resourceKind: string): Controller[] {
    return [...this.controllers.values()].filter((c) =>
      c.config.spec.watchResources.includes(resourceKind.toLowerCase()),
    )
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/operators/registry.ts src/engine/__tests__/registry.test.ts
git commit -m "feat: add Controller registry for Operator management"
```

---

### Task 11: Implement Deployment Controller

**Files:**
- Create: `src/engine/operators/deployment.ts`
- Create: `src/engine/__tests__/deployment.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { DeploymentController } from '../operators/deployment'
import type { ReconcileEvent, CustomResource } from '../../types/simulation'

describe('DeploymentController', () => {
  const ctrl = new DeploymentController()

  it('has name deployment-controller', () => {
    expect(ctrl.name).toBe('deployment-controller')
  })

  it('watches deployments', () => {
    expect(ctrl.config.spec.watchResources).toContain('deployments')
  })

  it('reconciles Added event: creates ReplicaSet', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'nginx', namespace: 'default' },
        spec: { replicas: 3, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    expect(results.length).toBeGreaterThanOrEqual(1)

    const hasReconcileMsg = results.some(r =>
      r.messages.some(m => m.type === 'RECONCILE_TRIGGERED')
    )
    expect(hasReconcileMsg).toBe(true)

    const hasCreateRs = results.some(r =>
      r.resourceChanges.created?.kind === 'ReplicaSet'
    )
    expect(hasCreateRs).toBe(true)
  })

  it('created ReplicaSet has correct replicas', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'nginx', namespace: 'default' },
        spec: { replicas: 3, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const rsResult = results.find(r => r.resourceChanges.created?.kind === 'ReplicaSet')
    expect(rsResult?.resourceChanges.created?.spec.replicas).toBe(3)
  })

  it('reconcile messages have operator phase', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'nginx', namespace: 'default' },
        spec: { replicas: 1, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    for (const result of results) {
      for (const msg of result.messages) {
        expect(msg.phase).toBe('operator')
      }
    }
  })

  it('sends UPDATE_STATUS after reconcile', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'nginx', namespace: 'default' },
        spec: { replicas: 1, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const hasStatusUpdate = results.some(r =>
      r.messages.some(m => m.type === 'UPDATE_STATUS')
    )
    expect(hasStatusUpdate).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/deployment.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement deployment.ts**

```typescript
import type {
  Controller,
  OperatorConfig,
  ReconcileEvent,
  ReconcileResult,
  SimMessage,
  CustomResource,
} from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

export class DeploymentController implements Controller {
  name = 'deployment-controller'
  config: OperatorConfig = {
    apiVersion: 'sim.k8s.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'deployment-controller',
      managedCRD: {
        group: 'apps', version: 'v1', kind: 'Deployment',
        plural: 'deployments', scope: 'Namespaced', versions: [],
      },
    },
    spec: { watchResources: ['deployments', 'replicasets'], reconcile: [] },
    ui: { icon: 'layers', color: '#3b82f6', position: 'right' },
  }

  reconcile(event: ReconcileEvent): ReconcileResult[] {
    const { t } = createTimestampFactory()
    const results: ReconcileResult[] = []
    const resource = event.resource
    const meta = resource.metadata as { name: string; namespace: string }
    const spec = resource.spec as { replicas: number; selector: Record<string, unknown> }

    // RECONCILE_TRIGGERED
    const triggerMsg: SimMessage = makeMessage({
      from: this.name,
      to: this.name,
      phase: 'operator',
      type: 'RECONCILE_TRIGGERED',
      request: { resource: meta.name, event: event.eventType },
      latency: 5,
    }, t)

    // CALCULATE_DIFF
    const diffMsg: SimMessage = makeMessage({
      from: this.name,
      to: this.name,
      phase: 'operator',
      type: 'CALCULATE_DIFF',
      request: { desired: spec.replicas, actual: 0 },
      response: { diff: spec.replicas },
      latency: 3,
    }, t)

    if (event.eventType === 'Added') {
      // Create ReplicaSet
      const rsName = `${meta.name}-abc123`
      const createdRs: CustomResource = {
        apiVersion: 'apps/v1',
        kind: 'ReplicaSet',
        metadata: { name: rsName, namespace: meta.namespace, uid: `rs-${rsName}` },
        spec: {
          replicas: spec.replicas,
          selector: spec.selector,
          template: (resource.spec as Record<string, unknown>).template ?? {},
        },
        status: {},
      }

      const createMsg: SimMessage = makeMessage({
        from: this.name,
        to: 'api-server',
        phase: 'operator',
        type: 'CREATE_RESOURCE',
        request: { kind: 'ReplicaSet', name: rsName, namespace: meta.namespace },
        response: { uid: createdRs.metadata.uid, created: true },
        latency: 15,
      }, t)

      const statusMsg: SimMessage = makeMessage({
        from: this.name,
        to: 'api-server',
        phase: 'operator',
        type: 'UPDATE_STATUS',
        request: { kind: 'Deployment', name: meta.name, status: { replicas: spec.replicas, readyReplicas: 0, conditions: [{ type: 'Progressing', status: 'True', reason: 'NewReplicaSetCreated' }] } },
        response: { updated: true },
        latency: 8,
      }, t)

      results.push({
        messages: [triggerMsg, diffMsg, createMsg, statusMsg],
        resourceChanges: { created: createdRs },
      })
    }

    return results
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/deployment.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/operators/deployment.ts src/engine/__tests__/deployment.test.ts
git commit -m "feat: implement Deployment Controller with reconcile logic"
```

---

### Task 12: Implement ReplicaSet Controller

**Files:**
- Create: `src/engine/operators/replicaset.ts`
- Create: `src/engine/__tests__/replicaset.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { ReplicaSetController } from '../operators/replicaset'
import type { ReconcileEvent } from '../../types/simulation'

describe('ReplicaSetController', () => {
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
        apiVersion: 'apps/v1',
        kind: 'ReplicaSet',
        metadata: { name: 'nginx-abc123', namespace: 'default' },
        spec: { replicas: 3, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const createdPods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    expect(createdPods).toHaveLength(3)
  })

  it('each created Pod has unique name', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1',
        kind: 'ReplicaSet',
        metadata: { name: 'nginx-abc123', namespace: 'default' },
        spec: { replicas: 2, selector: { matchLabels: { app: 'nginx' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const podNames = results
      .filter(r => r.resourceChanges.created?.kind === 'Pod')
      .map(r => r.resourceChanges.created!.metadata.name)
    const uniqueNames = new Set(podNames)
    expect(uniqueNames.size).toBe(podNames.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/replicaset.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement replicaset.ts**

```typescript
import type {
  Controller,
  OperatorConfig,
  ReconcileEvent,
  ReconcileResult,
  SimMessage,
  CustomResource,
} from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

export class ReplicaSetController implements Controller {
  name = 'replicaset-controller'
  config: OperatorConfig = {
    apiVersion: 'sim.k8s.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'replicaset-controller',
      managedCRD: {
        group: 'apps', version: 'v1', kind: 'ReplicaSet',
        plural: 'replicasets', scope: 'Namespaced', versions: [],
      },
    },
    spec: { watchResources: ['replicasets'], reconcile: [] },
    ui: { icon: 'copy', color: '#10b981', position: 'right' },
  }

  reconcile(event: ReconcileEvent): ReconcileResult[] {
    const { t } = createTimestampFactory()
    const results: ReconcileResult[] = []
    const resource = event.resource
    const meta = resource.metadata as { name: string; namespace: string }
    const spec = resource.spec as { replicas: number; selector: Record<string, unknown> }

    if (event.eventType === 'Added') {
      for (let i = 0; i < spec.replicas; i++) {
        const podName = `${meta.name}-${generatePodSuffix()}`

        const triggerMsg = makeMessage({
          from: this.name,
          to: this.name,
          phase: 'operator',
          type: 'RECONCILE_TRIGGERED',
          request: { resource: meta.name, pod: podName, event: 'Added' },
          latency: 3,
        }, t)

        const createMsg = makeMessage({
          from: this.name,
          to: 'api-server',
          phase: 'operator',
          type: 'CREATE_RESOURCE',
          request: { kind: 'Pod', name: podName, namespace: meta.namespace },
          response: { uid: `pod-${podName}`, created: true },
          latency: 12,
        }, t)

        const createdPod: CustomResource = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: podName, namespace: meta.namespace, uid: `pod-${podName}` },
          spec: { containers: [{ name: 'main', image: 'nginx:latest' }] },
          status: { phase: 'Pending' },
        }

        results.push({
          messages: [triggerMsg, createMsg],
          resourceChanges: { created: createdPod },
        })
      }
    }

    return results
  }
}

function generatePodSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 5; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/replicaset.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/operators/replicaset.ts src/engine/__tests__/replicaset.test.ts
git commit -m "feat: implement ReplicaSet Controller"
```

---

### Task 13: Implement DaemonSet Controller

**Files:**
- Create: `src/engine/operators/daemonset.ts`
- Create: `src/engine/__tests__/daemonset.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: { name: 'fluentd', namespace: 'kube-system' },
        spec: { selector: { matchLabels: { app: 'fluentd' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event, ['node-1', 'node-2'])
    const createdPods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    expect(createdPods).toHaveLength(2)
  })

  it('assigns node to each Pod', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: { name: 'fluentd', namespace: 'kube-system' },
        spec: { selector: { matchLabels: { app: 'fluentd' } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event, ['node-1', 'node-2'])
    const pods = results
      .filter(r => r.resourceChanges.created?.kind === 'Pod')
      .map(r => r.resourceChanges.created!)
    const nodeNames = pods.map(p => p.spec.nodeName)
    expect(nodeNames).toContain('node-1')
    expect(nodeNames).toContain('node-2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/daemonset.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement daemonset.ts**

Note: `reconcile` accepts optional `nodeNames` parameter. Update `Controller` interface later in Task 17; for now use a default.

```typescript
import type {
  Controller,
  OperatorConfig,
  ReconcileEvent,
  ReconcileResult,
  CustomResource,
} from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

export class DaemonSetController implements Controller {
  name = 'daemonset-controller'
  config: OperatorConfig = {
    apiVersion: 'sim.k8s.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'daemonset-controller',
      managedCRD: {
        group: 'apps', version: 'v1', kind: 'DaemonSet',
        plural: 'daemonsets', scope: 'Namespaced', versions: [],
      },
    },
    spec: { watchResources: ['daemonsets'], reconcile: [] },
    ui: { icon: 'server', color: '#f59e0b', position: 'right' },
  }

  reconcile(event: ReconcileEvent, nodeNames?: string[]): ReconcileResult[] {
    const { t } = createTimestampFactory()
    const results: ReconcileResult[] = []
    const resource = event.resource
    const meta = resource.metadata as { name: string; namespace: string }
    const nodes = nodeNames ?? ['node-1', 'node-2']

    if (event.eventType === 'Added') {
      for (const nodeName of nodes) {
        const podName = `${meta.name}-${nodeName}`

        const triggerMsg = makeMessage({
          from: this.name,
          to: this.name,
          phase: 'operator',
          type: 'RECONCILE_TRIGGERED',
          request: { resource: meta.name, node: nodeName },
          latency: 3,
        }, t)

        const createMsg = makeMessage({
          from: this.name,
          to: 'api-server',
          phase: 'operator',
          type: 'CREATE_RESOURCE',
          request: { kind: 'Pod', name: podName, namespace: meta.namespace, nodeName },
          response: { uid: `pod-${podName}`, created: true },
          latency: 12,
        }, t)

        const createdPod: CustomResource = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: podName, namespace: meta.namespace, uid: `pod-${podName}` },
          spec: { nodeName, containers: [{ name: 'main', image: 'fluentd:latest' }] },
          status: { phase: 'Pending' },
        }

        results.push({
          messages: [triggerMsg, createMsg],
          resourceChanges: { created: createdPod },
        })
      }
    }

    return results
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/daemonset.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/operators/daemonset.ts src/engine/__tests__/daemonset.test.ts
git commit -m "feat: implement DaemonSet Controller"
```

---

### Task 14: Implement Job Controller

**Files:**
- Create: `src/engine/operators/job.ts`
- Create: `src/engine/__tests__/job.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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

  it('creates Pods based on completions', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: { name: 'batch-job', namespace: 'default' },
        spec: { completions: 3, parallelism: 1, template: { spec: { containers: [{ name: 'worker', image: 'busybox' }] } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const createdPods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    expect(createdPods).toHaveLength(3)
  })

  it('respects parallelism limit', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: { name: 'parallel-job', namespace: 'default' },
        spec: { completions: 6, parallelism: 2, template: { spec: { containers: [{ name: 'worker', image: 'busybox' }] } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const createdPods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    // Creates min(completions, parallelism) pods initially
    expect(createdPods.length).toBeLessThanOrEqual(2)
  })

  it('defaults to 1 completion if not specified', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: { name: 'simple-job', namespace: 'default' },
        spec: { template: { spec: { containers: [{ name: 'worker', image: 'busybox' }] } } },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)
    const createdPods = results.filter(r => r.resourceChanges.created?.kind === 'Pod')
    expect(createdPods).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/job.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement job.ts**

```typescript
import type {
  Controller,
  OperatorConfig,
  ReconcileEvent,
  ReconcileResult,
  CustomResource,
} from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

export class JobController implements Controller {
  name = 'job-controller'
  config: OperatorConfig = {
    apiVersion: 'sim.k8s.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'job-controller',
      managedCRD: {
        group: 'batch', version: 'v1', kind: 'Job',
        plural: 'jobs', scope: 'Namespaced', versions: [],
      },
    },
    spec: { watchResources: ['jobs'], reconcile: [] },
    ui: { icon: 'briefcase', color: '#8b5cf6', position: 'right' },
  }

  reconcile(event: ReconcileEvent): ReconcileResult[] {
    const { t } = createTimestampFactory()
    const results: ReconcileResult[] = []
    const resource = event.resource
    const meta = resource.metadata as { name: string; namespace: string }
    const spec = resource.spec as { completions?: number; parallelism?: number; template: Record<string, unknown> }

    if (event.eventType === 'Added') {
      const completions = spec.completions ?? 1
      const parallelism = spec.parallelism ?? completions
      const batchSize = Math.min(completions, parallelism)

      for (let i = 0; i < batchSize; i++) {
        const podName = `${meta.name}-${generatePodSuffix()}`

        const triggerMsg = makeMessage({
          from: this.name,
          to: this.name,
          phase: 'operator',
          type: 'RECONCILE_TRIGGERED',
          request: { resource: meta.name, completion: i + 1 },
          latency: 3,
        }, t)

        const createMsg = makeMessage({
          from: this.name,
          to: 'api-server',
          phase: 'operator',
          type: 'CREATE_RESOURCE',
          request: { kind: 'Pod', name: podName, namespace: meta.namespace },
          response: { uid: `pod-${podName}`, created: true },
          latency: 12,
        }, t)

        const createdPod: CustomResource = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: {
            name: podName,
            namespace: meta.namespace,
            uid: `pod-${podName}`,
            labels: { 'job-name': meta.name, 'controller-uid': `job-${meta.name}` },
          },
          spec: spec.template.spec as Record<string, unknown>,
          status: { phase: 'Pending' },
        }

        results.push({
          messages: [triggerMsg, createMsg],
          resourceChanges: { created: createdPod },
        })
      }

      const statusMsg = makeMessage({
        from: this.name,
        to: 'api-server',
        phase: 'operator',
        type: 'UPDATE_STATUS',
        request: {
          kind: 'Job', name: meta.name,
          status: { active: batchSize, startTime: new Date().toISOString() },
        },
        response: { updated: true },
        latency: 8,
      }, t)

      results.push({ messages: [statusMsg], resourceChanges: {} })
    }

    return results
  }
}

function generatePodSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 5; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/job.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/operators/job.ts src/engine/__tests__/job.test.ts
git commit -m "feat: implement Job Controller"
```

---

### Task 15: Implement CronJob Controller

**Files:**
- Create: `src/engine/operators/cronjob.ts`
- Create: `src/engine/__tests__/cronjob.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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

  it('reconciles Added: triggers Job creation via CRON_TRIGGERED', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1',
        kind: 'CronJob',
        metadata: { name: 'hello-cron', namespace: 'default' },
        spec: {
          schedule: '*/1 * * * *',
          jobTemplate: {
            spec: {
              template: { spec: { containers: [{ name: 'hello', image: 'busybox' }] } },
            },
          },
        },
      },
      existingResources: [],
    }
    const results = ctrl.reconcile(event)

    const hasCronTrigger = results.some(r =>
      r.messages.some(m => m.type === 'CRON_TRIGGERED')
    )
    expect(hasCronTrigger).toBe(true)

    const hasCreateJob = results.some(r =>
      r.resourceChanges.created?.kind === 'Job'
    )
    expect(hasCreateJob).toBe(true)
  })

  it('created Job has correct name pattern', () => {
    const event: ReconcileEvent = {
      eventType: 'Added',
      resource: {
        apiVersion: 'batch/v1',
        kind: 'CronJob',
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/cronjob.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement cronjob.ts**

```typescript
import type {
  Controller,
  OperatorConfig,
  ReconcileEvent,
  ReconcileResult,
  CustomResource,
} from '../../types/simulation'
import { makeMessage, createTimestampFactory } from '../types'

export class CronJobController implements Controller {
  name = 'cronjob-controller'
  config: OperatorConfig = {
    apiVersion: 'sim.k8s.io/v1',
    kind: 'OperatorConfig',
    metadata: {
      name: 'cronjob-controller',
      managedCRD: {
        group: 'batch', version: 'v1', kind: 'CronJob',
        plural: 'cronjobs', scope: 'Namespaced', versions: [],
      },
    },
    spec: { watchResources: ['cronjobs'], reconcile: [] },
    ui: { icon: 'clock', color: '#ec4899', position: 'right' },
  }

  reconcile(event: ReconcileEvent): ReconcileResult[] {
    const { t } = createTimestampFactory()
    const results: ReconcileResult[] = []
    const resource = event.resource
    const meta = resource.metadata as { name: string; namespace: string }

    if (event.eventType === 'Added') {
      const jobName = `${meta.name}-${Date.now()}`

      const cronMsg = makeMessage({
        from: this.name,
        to: this.name,
        phase: 'operator',
        type: 'CRON_TRIGGERED',
        request: { schedule: (resource.spec as Record<string, unknown>).schedule },
        response: { triggered: true },
        latency: 2,
      }, t)

      const createMsg = makeMessage({
        from: this.name,
        to: 'api-server',
        phase: 'operator',
        type: 'CREATE_RESOURCE',
        request: { kind: 'Job', name: jobName, namespace: meta.namespace },
        response: { uid: `job-${jobName}`, created: true },
        latency: 15,
      }, t)

      const createdJob: CustomResource = {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: { name: jobName, namespace: meta.namespace, uid: `job-${jobName}` },
        spec: {
          template: ((resource.spec as Record<string, unknown>).jobTemplate as Record<string, unknown>).spec as Record<string, unknown>,
        },
        status: {},
      }

      results.push({
        messages: [cronMsg, createMsg],
        resourceChanges: { created: createdJob },
      })
    }

    return results
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/cronjob.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/operators/cronjob.ts src/engine/__tests__/cronjob.test.ts
git commit -m "feat: implement CronJob Controller"
```

---

### Task 16: Create operators index with built-in loading

**Files:**
- Create: `src/engine/operators/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
import type { Controller } from '../../types/simulation'
import { ControllerRegistry } from './registry'
import { DeploymentController } from './deployment'
import { ReplicaSetController } from './replicaset'
import { DaemonSetController } from './daemonset'
import { JobController } from './job'
import { CronJobController } from './cronjob'

const builtinControllers: Controller[] = [
  new DeploymentController(),
  new ReplicaSetController(),
  new DaemonSetController(),
  new JobController(),
  new CronJobController(),
]

export function createRegistryWithBuiltins(): ControllerRegistry {
  const registry = new ControllerRegistry()
  for (const ctrl of builtinControllers) {
    registry.register(ctrl)
  }
  return registry
}

export { ControllerRegistry } from './registry'
export { DeploymentController } from './deployment'
export { ReplicaSetController } from './replicaset'
export { DaemonSetController } from './daemonset'
export { JobController } from './job'
export { CronJobController } from './cronjob'
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/operators/index.ts
git commit -m "feat: add operators index with built-in controller loading"
```

---

### Task 17: Create operator phase engine

**Files:**
- Create: `src/engine/phases/operator.ts`
- Create: `src/engine/__tests__/operator-phase.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { generateOperatorPhase } from '../phases/operator'
import { createRegistryWithBuiltins } from '../operators'
import type { OperatorConfig } from '../../types/simulation'

describe('generateOperatorPhase', () => {
  it('produces no messages for Pod resource (no matching operator)', () => {
    const registry = createRegistryWithBuiltins()
    const { t } = createTimestampFactoryFactory()
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
      t: t,
    }, registry)
    expect(messages).toHaveLength(0)
  })

  it('produces messages for Deployment resource', () => {
    const registry = createRegistryWithBuiltins()
    const { t } = createTimestampFactoryFactory()
    const deploySpec = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'nginx-deploy', namespace: 'default' },
      spec: { replicas: 2, selector: { matchLabels: { app: 'nginx' } } },
    }
    const messages = generateOperatorPhase({
      podSpec: deploySpec,
      podName: 'nginx-deploy',
      namespace: 'default',
      operators: registry.getAll().map(c => c.config),
      customResources: {},
      nodeNames: ['node-1', 'node-2'],
      t: t,
    }, registry)

    expect(messages.length).toBeGreaterThan(0)
    const hasReconcileMsg = messages.some(m => m.type === 'RECONCILE_TRIGGERED')
    expect(hasReconcileMsg).toBe(true)
    const hasCreateRs = messages.some(m => m.type === 'CREATE_RESOURCE' && m.request.kind === 'ReplicaSet')
    expect(hasCreateRs).toBe(true)
  })

  it('chains: Deployment creates ReplicaSet which creates Pods', () => {
    const registry = createRegistryWithBuiltins()
    const { t } = createTimestampFactoryFactory()
    const deploySpec = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'nginx-deploy', namespace: 'default' },
      spec: { replicas: 1, selector: { matchLabels: { app: 'nginx' } } },
    }
    const messages = generateOperatorPhase({
      podSpec: deploySpec,
      podName: 'nginx-deploy',
      namespace: 'default',
      operators: registry.getAll().map(c => c.config),
      customResources: {},
      nodeNames: ['node-1', 'node-2'],
      t: t,
    }, registry)

    const hasCreatePod = messages.some(m => m.type === 'CREATE_RESOURCE' && (m.request as Record<string, unknown>).kind === 'Pod')
    expect(hasCreatePod).toBe(true)
  })
})

function createTimestampFactoryFactory() {
  const ts = Date.now()
  let offset = 0
  return { t: () => ts + offset++ }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/operator-phase.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement operator.ts**

```typescript
import type {
  SimMessage,
  OperatorConfig,
  CustomResource,
} from '../../types/simulation'
import type { ControllerRegistry } from '../operators/registry'
import type { OperatorPhaseInput } from '../types'

interface OperatorPhaseResult {
  messages: SimMessage[]
  customResources: Record<string, CustomResource>
}

export function generateOperatorPhase(
  input: OperatorPhaseInput,
  registry: ControllerRegistry,
): SimMessage[] {
  const { podSpec, t, nodeNames } = input
  const allMessages: SimMessage[] = []
  const resourceKind = (podSpec.kind as string) ?? ''
  const lowerKind = resourceKind.toLowerCase() + 's'

  const watchers = registry.findWatching(lowerKind)
  if (watchers.length === 0) {
    return allMessages
  }

  const pendingEvents: Array<{
    eventType: 'Added' | 'Modified' | 'Deleted'
    resource: Record<string, unknown>
    depth: number
  }> = [
    { eventType: 'Added', resource: podSpec, depth: 0 },
  ]

  const createdResources: CustomResource[] = []

  while (pendingEvents.length > 0) {
    const event = pendingEvents.shift()!
    if (event.depth > 3) break

    const eventKind = ((event.resource.kind as string) ?? '').toLowerCase() + 's'
    const controllers = registry.findWatching(eventKind)

    for (const ctrl of controllers) {
      const results = ctrl.reconcile(
        { eventType: event.eventType, resource: event.resource, existingResources: createdResources },
        nodeNames,
      )

      for (const result of results) {
        allMessages.push(...result.messages)
        if (result.resourceChanges.created) {
          createdResources.push(result.resourceChanges.created)
          pendingEvents.push({
            eventType: 'Added',
            resource: result.resourceChanges.created,
            depth: event.depth + 1,
          })
        }
      }
    }
  }

  return allMessages
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/operator-phase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/phases/operator.ts src/engine/__tests__/operator-phase.test.ts
git commit -m "feat: implement operator phase engine with chain reconcile"
```

---

### Task 18: Integrate operator phase into simulation engine

**Files:**
- Modify: `src/engine/phases/index.ts` — add operator export
- Modify: `src/engine/simulation.ts` — accept operators, wire in operator phase

- [ ] **Step 1: Update phases/index.ts**

Add to the exports:
```typescript
export { generateOperatorPhase } from './operator'
```

- [ ] **Step 2: Update simulation.ts**

Add import for `generateOperatorPhase` and `createRegistryWithBuiltins`. Update `generateMessages` to accept optional `operators` parameter and call operator phase when the resource is a CRD:

```typescript
import { generateOperatorPhase } from './phases/operator'
import { createRegistryWithBuiltins } from './operators'
import type { OperatorConfig } from '../types/simulation'
```

Update the function signature:
```typescript
export function generateMessages(
  podSpec: Record<string, unknown>,
  plugins: PluginConfig[],
  scenario?: Scenario,
  operators?: OperatorConfig[],
): SimMessage[] {
```

Insert operator phase between controller and scheduling:
```typescript
  // Operator phase (only for CRD resources)
  const resourceKind = String(podSpec.kind ?? '')
  const isPod = resourceKind === 'Pod' || !resourceKind
  if (!isPod) {
    const registry = createRegistryWithBuiltins()
    const operatorMessages = generateOperatorPhase(
      { podSpec, podName, namespace, operators: operators ?? [], customResources: {}, nodeNames: defaultNodeResources.map(n => n.name), t },
      registry,
    )
    messages.push(...operatorMessages)
  }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/phases/index.ts src/engine/simulation.ts
git commit -m "feat: integrate operator phase into simulation engine"
```

---

### Task 19: Update Zustand store

**Files:**
- Modify: `src/store/simulation-store.ts`

- [ ] **Step 1: Add operators state and actions**

Add imports:
```typescript
import type {
  // ... existing imports ...
  OperatorConfig,
  CustomResource,
} from '../types/simulation'
```

Add to `SimulationState` interface:
```typescript
  operators: OperatorConfig[]
  customResources: Record<string, Record<string, CustomResource>>

  addOperator: (operator: OperatorConfig) => void
  removeOperator: (name: string) => void
  loadBuiltinOperators: () => void
```

Add initial state in `create`:
```typescript
  operators: [],
  customResources: {},
```

Add actions:
```typescript
  addOperator(operator) {
    set((state) => ({ operators: [...state.operators, operator] }))
  },

  removeOperator(name) {
    set((state) => ({
      operators: state.operators.filter((o) => o.metadata.name !== name),
    }))
  },

  loadBuiltinOperators() {
    const { DeploymentController } = require('../engine/operators/deployment')
    const { ReplicaSetController } = require('../engine/operators/replicaset')
    const { DaemonSetController } = require('../engine/operators/daemonset')
    const { JobController } = require('../engine/operators/job')
    const { CronJobController } = require('../engine/operators/cronjob')
    set((state) => ({
      operators: [
        ...state.operators,
        new DeploymentController().config,
        new ReplicaSetController().config,
        new DaemonSetController().config,
        new JobController().config,
        new CronJobController().config,
      ],
    }))
  },
```

Update `startSimulation` to pass operators:
```typescript
  startSimulation(podSpec, scenario) {
    const plugins = get().plugins
    const operators = get().operators
    const messages = generateMessages(podSpec, plugins, scenario, operators)
    // ... rest stays the same
  },
```

Update `reset` to clear operators and customResources:
```typescript
  reset() {
    set({
      status: 'idle',
      messages: [],
      currentIndex: -1,
      speed: 1,
      resources: getDefaultResources(),
      nodes: getDefaultNodes(),
      breakpoints: [],
      customResources: {},
    })
  },
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/store/simulation-store.ts
git commit -m "feat: add operators and customResources to Zustand store"
```

---

### Task 20: Update node layout and Flow canvas

**Files:**
- Modify: `src/components/canvas/node-layout.ts`
- Modify: `src/components/canvas/FlowCanvas.tsx`
- Modify: `src/components/canvas/K8sNode.tsx`

- [ ] **Step 1: Update node-layout.ts**

Add controller node positions and edge builder function:

```typescript
export const builtinPositions: Record<string, { x: number; y: number }> = {
  'user':               { x: 50, y: 300 },
  'api-server':         { x: 250, y: 300 },
  'etcd':               { x: 450, y: 300 },
  'controller-manager': { x: 450, y: 100 },
  'scheduler':          { x: 450, y: 500 },
  'kubelet':            { x: 700, y: 300 },
  'cri':                { x: 950, y: 200 },
  'cni':                { x: 950, y: 350 },
  'csi':                { x: 950, y: 500 },
  // Built-in controllers
  'deployment-controller':  { x: 250, y: 0 },
  'replicaset-controller':  { x: 250, y: -80 },
  'daemonset-controller':   { x: 650, y: 0 },
  'job-controller':         { x: 650, y: -80 },
  'cronjob-controller':     { x: 650, y: -160 },
}

export const builtinEdges = [
  { id: 'e-user-api', source: 'user', target: 'api-server', label: 'kubectl' },
  { id: 'e-api-etcd', source: 'api-server', target: 'etcd', label: 'HTTP' },
  { id: 'e-etcd-ctrl', source: 'etcd', target: 'controller-manager', label: 'Watch' },
  { id: 'e-etcd-sched', source: 'etcd', target: 'scheduler', label: 'Watch' },
  { id: 'e-sched-api', source: 'scheduler', target: 'api-server', label: 'Bind' },
  { id: 'e-etcd-kubelet', source: 'etcd', target: 'kubelet', label: 'Watch' },
  { id: 'e-kubelet-api', source: 'kubelet', target: 'api-server', label: 'Status' },
  { id: 'e-kubelet-cri', source: 'kubelet', target: 'cri', label: 'gRPC' },
  { id: 'e-kubelet-cni', source: 'kubelet', target: 'cni', label: 'CNI' },
  { id: 'e-kubelet-csi', source: 'kubelet', target: 'csi', label: 'CSI' },
  // Controller edges
  { id: 'e-etcd-deploy', source: 'etcd', target: 'deployment-controller', label: 'Watch' },
  { id: 'e-deploy-api', source: 'deployment-controller', target: 'api-server', label: 'Write' },
  { id: 'e-etcd-rs', source: 'etcd', target: 'replicaset-controller', label: 'Watch' },
  { id: 'e-rs-api', source: 'replicaset-controller', target: 'api-server', label: 'Write' },
  { id: 'e-etcd-ds', source: 'etcd', target: 'daemonset-controller', label: 'Watch' },
  { id: 'e-ds-api', source: 'daemonset-controller', target: 'api-server', label: 'Write' },
  { id: 'e-etcd-job', source: 'etcd', target: 'job-controller', label: 'Watch' },
  { id: 'e-job-api', source: 'job-controller', target: 'api-server', label: 'Write' },
  { id: 'e-etcd-cj', source: 'etcd', target: 'cronjob-controller', label: 'Watch' },
  { id: 'e-cj-api', source: 'cronjob-controller', target: 'api-server', label: 'Write' },
]

export function buildOperatorEdges(operatorNames: string[]): typeof builtinEdges {
  return operatorNames
    .filter((name) => !builtinPositions[name])
    .map((name, i) => {
      const y = -240 - i * 80
      return [
        { id: `e-etcd-${name}`, source: 'etcd', target: name, label: 'Watch' },
        { id: `e-${name}-api`, source: name, target: 'api-server', label: 'Write' },
      ]
    })
    .flat()
}

export function getOperatorPosition(name: string, index: number): { x: number; y: number } {
  return builtinPositions[name] ?? { x: 850, y: -240 - index * 80 }
}
```

- [ ] **Step 2: Update K8sNode.tsx**

Add controller colors to `componentColors`:

```typescript
const componentColors: Record<string, string> = {
  'api-server': '#326CE5',
  'etcd': '#4CAF50',
  'controller-manager': '#FF9800',
  'scheduler': '#9C27B0',
  'kubelet': '#00BCD4',
  'cri': '#607D8B',
  'cni': '#FF5722',
  'csi': '#795548',
  'deployment-controller': '#3b82f6',
  'replicaset-controller': '#10b981',
  'daemonset-controller': '#f59e0b',
  'job-controller': '#8b5cf6',
  'cronjob-controller': '#ec4899',
}
```

- [ ] **Step 3: Update FlowCanvas.tsx**

Import new helpers and include operator nodes/edges:

```typescript
import { builtinPositions, builtinEdges, buildOperatorEdges, getOperatorPosition } from './node-layout'
```

Update `flowNodes` to handle operator nodes:
```typescript
  const flowNodes: Node[] = useMemo(() => {
    return simNodes.map((sn, i) => {
      const pos = builtinPositions[sn.id] ?? getOperatorPosition(sn.id, i)
      const isActive = sn.id === activeFrom || sn.id === activeTo
      return {
        id: sn.id,
        type: 'k8s',
        position: pos,
        data: {
          simNode: sn,
          isActive,
          activeError: isActive && hasError,
        },
      }
    })
  }, [simNodes, activeFrom, activeTo, hasError])
```

Update `flowEdges` to include operator edges:
```typescript
  const flowEdges: Edge[] = useMemo(() => {
    const operatorNames = simNodes
      .filter(sn => sn.id.includes('-controller') || sn.id.includes('-operator'))
      .map(sn => sn.id)
    const allEdges = [...builtinEdges, ...buildOperatorEdges(operatorNames)]

    return allEdges.map((e) => {
      const isActive =
        !!currentMsg &&
        ((currentMsg.from === e.source && currentMsg.to === e.target) ||
         (currentMsg.from === e.target && currentMsg.to === e.source))

      return {
        ...e,
        animated: isActive,
        style: {
          stroke: isActive ? (currentMsg?.error ? '#ef4444' : '#3b82f6') : '#555',
          strokeWidth: isActive ? 3 : 1,
        },
        labelStyle: { fill: '#aaa', fontSize: 10 },
      }
    })
  }, [currentMsg, simNodes])
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/node-layout.ts src/components/canvas/FlowCanvas.tsx src/components/canvas/K8sNode.tsx
git commit -m "feat: add controller nodes and edges to Flow canvas"
```

---

### Task 21: Update Timeline for operator phase

**Files:**
- Modify: `src/components/timeline/Timeline.tsx`

- [ ] **Step 1: Add operator to phaseColors and phase labels**

Update `phaseColors`:
```typescript
const phaseColors: Record<Phase, string> = {
  submit: '#3b82f6',
  controller: '#f59e0b',
  operator: '#ef4444',
  scheduling: '#8b5cf6',
  kubelet: '#06b6d4',
  completed: '#22c55e',
}
```

Update phase labels array at the bottom:
```typescript
{(['submit', 'controller', 'operator', 'scheduling', 'kubelet', 'completed'] as Phase[]).map((phase) => (
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/Timeline.tsx
git commit -m "feat: add operator phase to timeline"
```

---

### Task 22: Add Operator fault scenarios

**Files:**
- Modify: `src/data/scenarios.ts`

- [ ] **Step 1: Add Operator scenarios**

Add Deployment and DaemonSet scenarios after existing ones:

```typescript
export const scenarios: Scenario[] = [
  // ... existing 5 scenarios ...

  {
    id: 'deployment-normal',
    name: 'Normal Deployment',
    description: 'Deployment creates ReplicaSet which creates Pods',
    podYaml: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'nginx-deploy', namespace: 'default', labels: { app: 'nginx' } },
      spec: { replicas: 2, selector: { matchLabels: { app: 'nginx' } }, template: { spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] } } },
    },
    resourceType: 'Deployment',
    operators: ['deployment-controller', 'replicaset-controller'],
  },
  {
    id: 'deployment-reconcile-failure',
    name: 'Reconcile Failure',
    description: 'Operator fails to create ReplicaSet during reconcile',
    podYaml: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'failing-deploy', namespace: 'default' },
      spec: { replicas: 1, selector: { matchLabels: { app: 'nginx' } }, template: { spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] } } },
    },
    resourceType: 'Deployment',
    operators: ['deployment-controller', 'replicaset-controller'],
    injectErrors: [
      { phase: 'operator', messageType: 'CREATE_RESOURCE', error: { code: 500, message: 'Failed to create ReplicaSet: etcd unavailable', retryable: true } },
    ],
  },
  {
    id: 'daemonset-normal',
    name: 'Normal DaemonSet',
    description: 'DaemonSet creates one Pod per node',
    podYaml: {
      apiVersion: 'apps/v1',
      kind: 'DaemonSet',
      metadata: { name: 'fluentd', namespace: 'kube-system' },
      spec: { selector: { matchLabels: { app: 'fluentd' } }, template: { spec: { containers: [{ name: 'fluentd', image: 'fluentd:latest' }] } } },
    },
    resourceType: 'DaemonSet',
    operators: ['daemonset-controller'],
  },
  {
    id: 'job-normal',
    name: 'Normal Job',
    description: 'Job creates Pods to completion',
    podYaml: {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: { name: 'batch-job', namespace: 'default' },
      spec: { completions: 2, parallelism: 1, template: { spec: { containers: [{ name: 'worker', image: 'busybox' }], restartPolicy: 'Never' } } },
    },
    resourceType: 'Job',
    operators: ['job-controller'],
  },
]
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/data/scenarios.ts
git commit -m "feat: add Operator fault scenarios (Deployment, DaemonSet, Job)"
```

---

### Task 23: Update Toolbar for grouped scenarios

**Files:**
- Modify: `src/components/toolbar/Toolbar.tsx`

- [ ] **Step 1: Update Toolbar with grouped dropdown**

```typescript
import { useState } from 'react'
import { useSimulationStore } from '../../store/simulation-store'
import { scenarios } from '../../data/scenarios'

const resourceTypeLabels: Record<string, string> = {
  Pod: 'Pod Scenarios',
  Deployment: 'Deployment Scenarios',
  DaemonSet: 'DaemonSet Scenarios',
  Job: 'Job Scenarios',
}

export function Toolbar() {
  const { startSimulation, status, reset, loadBuiltinOperators } = useSimulationStore()
  const [selectedScenario, setSelectedScenario] = useState('normal')

  const handleStart = () => {
    const scenario = scenarios.find(s => s.id === selectedScenario)
    if (scenario) {
      if (scenario.operators && scenario.operators.length > 0) {
        loadBuiltinOperators()
      }
      startSimulation(scenario.podYaml, scenario)
    }
  }

  const selectedScenarioData = scenarios.find(s => s.id === selectedScenario)
  const buttonText = selectedScenarioData?.resourceType
    ? `Create ${selectedScenarioData.resourceType}`
    : 'Create Pod'

  const grouped = scenarios.reduce<Record<string, typeof scenarios>>((acc, s) => {
    const type = s.resourceType ?? 'Pod'
    if (!acc[type]) acc[type] = []
    acc[type].push(s)
    return acc
  }, {})

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Scenario:</span>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600"
        >
          {Object.entries(grouped).map(([type, group]) => (
            <optgroup key={type} label={resourceTypeLabels[type] ?? type}>
              {group.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <button
        onClick={handleStart}
        disabled={status === 'running'}
        className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded text-xs font-medium"
      >
        {buttonText}
      </button>

      <button
        onClick={reset}
        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
      >
        Reset
      </button>

      <span className={`text-xs ${
        status === 'running' ? 'text-green-400' :
        status === 'paused' ? 'text-yellow-400' :
        status === 'completed' ? 'text-blue-400' :
        'text-gray-400'
      }`}>
        {status.toUpperCase()}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/toolbar/Toolbar.tsx
git commit -m "feat: update Toolbar with grouped scenario selector"
```

---

### Task 24: Update Plugin Editor with Operator tab

**Files:**
- Modify: `src/components/toolbar/PluginEditor.tsx`

- [ ] **Step 1: Add Operator tab to PluginEditor**

Add tab state and Operator YAML template. Show built-in controllers as read-only list. Keep existing Plugin tab unchanged. Add tab switching UI at the top of the modal.

Key additions to the component:
```typescript
const [tab, setTab] = useState<'plugin' | 'operator'>('plugin')
```

Built-in controller list (read-only):
```typescript
const builtinOperators = [
  { name: 'deployment-controller', kind: 'Deployment', color: '#3b82f6' },
  { name: 'replicaset-controller', kind: 'ReplicaSet', color: '#10b981' },
  { name: 'daemonset-controller', kind: 'DaemonSet', color: '#f59e0b' },
  { name: 'job-controller', kind: 'Job', color: '#8b5cf6' },
  { name: 'cronjob-controller', kind: 'CronJob', color: '#ec4899' },
]
```

Add default Operator YAML template for custom operators:
```typescript
const defaultOperatorYaml = `apiVersion: sim.k8s.io/v1
kind: OperatorConfig
metadata:
  name: my-custom-operator
  managedCRD:
    group: example.com
    version: v1
    kind: MyResource
    plural: myresources
    scope: Namespaced
    versions: []
spec:
  watchResources:
    - myresources
  reconcile:
    - watchResource: myresources
      onEvent: Added
      actions:
        - type: createResource
          target:
            apiVersion: v1
            kind: ConfigMap
          template:
            metadata:
              name: "{{metadata.name}}-config"
            data:
              key: value
ui:
  icon: cog
  color: "#e74c3c"
  position: right
`
```

The Operator tab shows: built-in controllers list (read-only badges) + YAML editor for custom operators + Add Operator button.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/toolbar/PluginEditor.tsx
git commit -m "feat: add Operator tab to Plugin Editor"
```

---

### Task 25: Update DetailPanel for CRD resources

**Files:**
- Modify: `src/components/detail/DetailPanel.tsx`

- [ ] **Step 1: Add Custom Resources section to status tab**

In the status tab, after the Nodes section, add:

```tsx
<div>
  <div className="text-xs text-gray-500 mb-2">Custom Resources</div>
  {Object.keys(resources.customResources).length === 0 ? (
    <div className="text-gray-600 text-xs">No custom resources</div>
  ) : (
    Object.entries(resources.customResources).flatMap(([gvk, resourcesByName]) =>
      Object.entries(resourcesByName).map(([name, cr]) => (
        <div key={`${gvk}-${name}`} className="text-xs mb-1">
          <span className="text-white">{name}</span>{' '}
          <span className="text-cyan-400">{cr.kind}</span>
          {cr.status?.phase && <span className="text-yellow-400 ml-1">{String(cr.status.phase)}</span>}
        </div>
      ))
    )
  )}
</div>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/detail/DetailPanel.tsx
git commit -m "feat: show custom resources in DetailPanel status tab"
```

---

### Task 26: Final verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS, no TypeScript errors

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`

Open http://localhost:5173 and verify:
1. Normal Pod creation scenario still works
2. Select "Normal Deployment" scenario → Create Deployment button appears → click → controller nodes visible on canvas → messages flow through operator phase
3. Timeline shows red dots for operator phase
4. Select "Normal DaemonSet" → creates Pods per node
5. Select "Normal Job" → creates Job Pods
6. Plugin Editor shows Operator tab with built-in controller list

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Operator framework with 5 built-in controllers"
```
