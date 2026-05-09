# Operator Framework Design

## Overview

Add a complete Operator framework to the K8s scheduler mock, enabling users to define CRDs, configure reconcile loops, and visualize controller chains on the Flow canvas. The framework serves both educational (understanding Operator patterns) and testing (simulating custom controller behavior) purposes.

## Approach

**Independent Operator subsystem** (Approach B) — create a new `OperatorConfig` type alongside the existing `PluginConfig`, with a new `operator` phase in the simulation engine. Built-in controllers are registered separately from user-defined Operators.

## Type System

### New Phase

```typescript
export type Phase = 'submit' | 'controller' | 'operator' | 'scheduling' | 'kubelet' | 'completed'
```

`operator` inserts between `controller` and `scheduling`.

### CRD Definition

```typescript
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
```

### Reconcile Rules

```typescript
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
```

### Operator Config

```typescript
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
```

### Extended Resource Store

```typescript
export interface ResourceStore {
  pods: Record<string, PodResource>
  nodes: Record<string, NodeResource>
  pvcs: Record<string, PVCResource>
  configmaps: Record<string, Record<string, unknown>>
  customResources: Record<string, Record<string, CustomResource>>
}

export interface CustomResource {
  apiVersion: string
  kind: string
  metadata: { name: string; namespace: string; uid?: string }
  spec: Record<string, unknown>
  status: Record<string, unknown>
}
```

## Simulation Engine

### File Structure

```
src/engine/
  simulation.ts            → Entry point, orchestrates phases
  phases/
    submit.ts              → Phase 1: user submits resource (extracted)
    controller.ts          → Phase 2: controller-manager base handling
    operator.ts            → Phase 3: Operator reconcile loops (new)
    scheduling.ts          → Phase 4: scheduler (extracted)
    kubelet.ts             → Phase 5: kubelet execution (extracted)
  operators/
    deployment.ts          → Built-in Deployment Controller
    replicaset.ts          → Built-in ReplicaSet Controller
    daemonset.ts           → Built-in DaemonSet Controller
    job.ts                 → Built-in Job Controller
    cronjob.ts             → Built-in CronJob Controller
    registry.ts            → Controller registry + chain reconcile orchestration
```

### Operator Reconcile Loop

```
User creates Deployment (CRD resource)
    |
    +-- etcd WATCH_EVENT -> Deployment Controller
    |   +-- RECONCILE_TRIGGERED (observe diff)
    |   +-- CALCULATE_DIFF (desired vs actual)
    |   +-- CREATE_RESOURCE (create ReplicaSet)
    |   +-- UPDATE_STATUS (update Deployment status)
    |
    +-- etcd WATCH_EVENT -> ReplicaSet Controller
    |   +-- RECONCILE_TRIGGERED
    |   +-- CALCULATE_DIFF
    |   +-- CREATE_RESOURCE x N (create Pods per replicas)
    |   +-- UPDATE_STATUS
    |
    +-- Pods enter normal scheduling flow (scheduling -> kubelet)
```

### Engine Core

```typescript
interface OperatorEngineInput {
  operators: OperatorConfig[]
  customResources: CustomResource[]
  podSpec: Record<string, unknown>
}

interface OperatorEngineOutput {
  messages: SimMessage[]
  resourceChanges: {
    created: CustomResource[]
    updated: CustomResource[]
    deleted: string[]
  }
}

function generateOperatorMessages(
  input: OperatorEngineInput,
  t: () => number
): OperatorEngineOutput
```

Processing:
1. Iterate all registered Operators, match watchResources against current events
2. For matched Operators, execute reconcile rule chain
3. Each reconcile action generates corresponding messages
4. Newly created resources may trigger downstream Operators (chain reconcile)
5. Chain depth capped at 3 levels to prevent infinite loops

### Controller Interface

All built-in and user-defined Operators implement a unified interface:

```typescript
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

### Template Variable Resolution

`{{variable}}` references in action templates resolve from the triggering resource's field path. For example, `{{deployment.spec.replicas}}` extracts `spec.replicas` from the resource that triggered the reconcile. Nested paths use dot notation.

### Built-in Controllers (Batch 1: Workload)

| Controller | Watch | Reconcile Behavior |
|-----------|-------|-------------------|
| Deployment | `deployments` | Create/update ReplicaSet, manage rolling update strategy |
| ReplicaSet | `replicasets` | Create/delete Pods per `spec.replicas` |
| DaemonSet | `daemonsets` | Create one Pod per node |
| Job | `jobs` | Create Pods until completions count met |
| CronJob | `cronjobs` | Trigger Job creation on schedule |

Chain relationships:
```
CronJob -> Job -> Pod
Deployment -> ReplicaSet -> Pod
DaemonSet -> Pod (per node)
```

### Future Batches

**Batch 2 (Storage):** PV Controller, AttachDetach Controller
**Batch 3 (Network + Node + Resource):** Service Controller, Node Controller, Namespace Controller, Garbage Collector

## Flow Canvas Integration

### New Nodes

Controller nodes are added dynamically based on registered Operators:
```
deployment-controller, replicaset-controller, daemonset-controller,
job-controller, cronjob-controller
```

### Node Layout

Controller nodes fan out below `controller-manager` in two columns:

```
                    +------------------+
                    |  controller-mgr  |
                    +--------+---------+
              +--------------+--------------+
     +--------+-------+     |     +--------+-------+
     | deployment-ctrl|     |     | daemonset-ctrl |
     +--------+-------+     |     +--------+-------+
     +--------+-------+     |     +--------+-------+
     | replicaset-ctrl|     |     | job-ctrl       |
     +----------------+     |     +--------+-------+
                            |     +--------+-------+
                            |     | cronjob-ctrl   |
                            |     +----------------+
```

- Built-in controller positions are predefined
- User-defined Operator positions are calculated dynamically after predefined slots

### Edges

Each registered Operator generates:
1. `etcd -> {operator-name}` — watch event stream
2. `{operator-name} -> api-server` — reconcile write-back operations
3. `{operator-name} -> etcd -> {downstream-operator}` — chain triggers via etcd watch

### Message Flow Visualization

```
etcd --WATCH_EVENT (resource Added/Modified/Deleted)--> operator-node
operator-node --RECONCILE_TRIGGERED (self-loop)--> operator-node
operator-node --CALCULATE_DIFF (self-loop)--> operator-node
operator-node --CREATE/UPDATE/DELETE_RESOURCE--> api-server
operator-node --UPDATE_STATUS--> api-server
```

- `RECONCILE_TRIGGERED` and `CALCULATE_DIFF` are self-loop messages (pulse animation)
- CRUD operation messages travel `operator -> api-server` edges (same highlight as existing)
- Error messages carry `SimError`, edges turn red (reuse existing error visualization)

## Store Changes

### New State

```typescript
interface SimulationState {
  // ... existing fields ...
  operators: OperatorConfig[]
  customResources: Record<string, Record<string, CustomResource>>
  addOperator: (operator: OperatorConfig) => void
  removeOperator: (name: string) => void
  loadBuiltinOperators: () => void
}
```

### startSimulation Adjustment

1. User submits resource (Pod or CRD)
2. Determine resource type:
   - Pod -> skip operator phase, go straight to scheduling
   - CRD (matches an Operator's managedCRD) -> trigger operator reconcile
3. Reconcile-produced Pods enter scheduling -> kubelet phases
4. `customResources` updated as messages are played back

### stepForward Enhancement

When advancing through `operator` phase messages, update `customResources` to reflect creates/updates/deletes.

## Plugin Editor Changes

### Dual-Mode Editor

Top tab bar switches between:
- **Plugin** — existing CNI/CSI/OperatorPlugin YAML editing (unchanged)
- **Operator** — new OperatorConfig YAML editing

### Operator Templates

Built-in controller templates are pre-filled and **read-only** (users can view but not modify built-in behavior). User-defined Operators are fully editable.

### YAML Validation

Schema validation for `OperatorConfig`:
- `metadata.managedCRD` required
- `spec.reconcile` must not be empty
- Each `ReconcileAction.type` must be a valid enum value
- `{{variable}}` references in templates must be resolvable

## Error Scenarios

### New Operator Fault Scenarios

| Scenario | Description | Injection Point |
|----------|-------------|-----------------|
| Reconcile Failure | Operator fails to create resource during reconcile | `CREATE_RESOURCE` message with 500 error |
| Insufficient Replicas | ReplicaSet cannot create enough Pods | `CREATE_RESOURCE` partial failure |
| DaemonSet Node Failure | Some nodes NotReady, DaemonSet Pods unschedulable | Scheduling phase node unavailability |
| Job Timeout | Job Pods never complete within deadline | `TRACK_COMPLETION` timeout error |
| CronJob Concurrency | Two cron triggers overlap, concurrent Jobs | `CRON_TRIGGERED` warning message |

### Scenario Type Extension

```typescript
export interface Scenario {
  // ... existing fields ...
  resourceType?: 'Pod' | 'Deployment' | 'DaemonSet' | 'Job' | 'CronJob'
  operators?: string[]
}
```

## Coexistence with Existing Plugin System

| System | Scope | Phase |
|--------|-------|-------|
| `PluginConfig` (CNI/CSI) | Network/storage plugins | kubelet phase |
| `PluginConfig` (OperatorPlugin) | Legacy, marked deprecated | controller phase |
| `OperatorConfig` (built-in) | Deployment, ReplicaSet, etc. | operator phase |
| `OperatorConfig` (user-defined) | Custom controllers | operator phase |

## Toolbar Changes

- Scenario dropdown grouped by resource type: Pod / Deployment / DaemonSet / Job
- Selecting a Deployment scenario auto-activates relevant built-in controllers
- "Create Pod" button becomes generic "Create Resource", showing form matching selected scenario type

## File Change Summary

| File | Change | Description |
|------|--------|-------------|
| `src/types/simulation.ts` | Modify | Add OperatorConfig, CRDSpec, ReconcileRule, CustomResource types |
| `src/engine/simulation.ts` | Modify | Split into phases/ modules, add operator phase orchestration |
| `src/engine/operators/*.ts` | New | 5 built-in controllers + registry |
| `src/engine/phases/*.ts` | New | Per-phase message generators |
| `src/store/simulation-store.ts` | Modify | Add operators, customResources state |
| `src/components/canvas/node-layout.ts` | Modify | Add controller node positions and edges |
| `src/components/toolbar/PluginEditor.tsx` | Modify | Dual-mode editor with Operator tab |
| `src/components/toolbar/Toolbar.tsx` | Modify | Multi-resource-type scenario selector |
| `src/data/scenarios.ts` | Modify | Add Operator fault scenarios |
