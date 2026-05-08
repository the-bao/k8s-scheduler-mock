# K8s Pod Creation Visualizer - Design Document

## Overview

A visualization tool for the complete Kubernetes Pod creation lifecycle, covering API Server → etcd → Controller Manager → Scheduler → Kubelet → CNI → CSI. Targeted at K8s ops/developers for understanding component interactions and debugging custom controllers, CSI drivers, and CNI plugins.

## Tech Stack

- React + TypeScript
- React Flow (node/edge graph + animation)
- Zustand (state management)
- YAML-defined plugin system (pure frontend)

## Architecture

Three layers:

### 1. Simulation Engine

Event-driven state machine managing the full Pod creation lifecycle.

- Each K8s component (API Server, etcd, Controller Manager, Scheduler, Kubelet, CNI, CSI) modeled as a SimNode
- SimNodes have input/output ports, receive messages, process logic, emit messages
- Messages carry type, payload, timestamp, driving animation playback

### 2. Plugin System

Users define custom components (Operator, CSI Driver, CNI Plugin) via YAML.

```yaml
apiVersion: sim.k8s.io/v1
kind: OperatorPlugin          # OperatorPlugin | CNIPlugin | CSIPlugin
metadata:
  name: my-operator
  watchResources:
    - pods
    - deployments
spec:
  reconcile:
    - match:
        resource: pods
        labelSelector:
          app: my-app
      actions:
        - type: createResource
          resource:
            apiVersion: v1
            kind: ConfigMap
            name: "{{ .pod.name }}-config"
            data:
              key: value
        - type: patchPod
          patch:
            status.conditions:
              - type: Initialized
                status: "True"
  ui:
    icon: cog
    color: "#e74c3c"
    position: right
```

CNI action types: `setupNetwork`, `assignIP`, `addRoutes`, `fail`
CSI action types: `provisionVolume`, `attachVolume`, `mountVolume`, `fail`

Plugin loading: edit YAML in frontend → schema validation → register as SimNode → inject into message flow at the corresponding Phase.

Debugging support: breakpoints before any action, error injection (`type: fail`) triggering K8s retry/backoff logic.

### 3. Visualization Layer

React Flow renders the K8s architecture graph. Animated particles on edges represent data flow. Right panel shows request/response details. Bottom timeline supports playback.

## Message Flow - Pod Creation Lifecycle

### Phase 1: Submit & Persist
1. User submits Pod YAML → API Server (`CREATE /api/v1/namespaces/{ns}/pods`)
2. API Server → etcd (write Pod object, status=Pending)
3. etcd → API Server (write success response)

### Phase 2: Controller Processing
4. Controller Manager watches new Pod event (if Pod belongs to Deployment/RS, trigger reconcile)
5. Custom Operator plugins intercept here, can generate additional resources

### Phase 3: Scheduling
6. Scheduler watches unscheduled Pod (`spec.nodeName=""`)
7. Scheduler executes Filter + Score, displays per-node scores
8. Scheduler binds Pod to target Node → API Server (update `spec.nodeName`)
9. API Server → etcd (update Pod)

### Phase 4: Kubelet Execution
10. Kubelet watches Pod bound to this Node
11. Kubelet calls CRI to create container sandbox
12. Kubelet → CNI plugin (network setup, IP assignment)
13. Kubelet → CSI plugin (volume mount)
14. Container image pull + start
15. Pod status → Running → API Server → etcd

Each message carries full mock data (request body, response body, latency).

## UI Layout

### Left: Architecture Panel (React Flow, ~60% width)
- Pre-laid K8s core components
- Plugin nodes shown with dashed borders
- Animated particles on edges: blue=normal, red=error, yellow=retry
- Pulse highlight on active nodes

### Right: Detail Panel (~25% width)
Three tabs:
- **Request/Response** — Full JSON for current step
- **Logs** — Mock component log stream (timestamp + component name + level)
- **Status** — Live resource state (Pod, Node, PV/PVC)

### Bottom: Timeline (~15% height)
- Horizontal timeline, one dot per message
- Controls: play/pause, step forward/back, speed (0.5x / 1x / 2x / 5x)
- Draggable playhead for replay

### Top: Toolbar
- "Create Pod" button with preset YAML templates
- Plugin manager (load/edit/delete)
- Scenario selector (preset fault scenarios)

## Data Model

```typescript
interface SimMessage {
  id: string
  from: string
  to: string
  phase: Phase
  type: string          // CREATE_POD / WATCH_EVENT / BIND / CNI_SETUP etc.
  request: object
  response?: object
  error?: SimError
  latency: number
  timestamp: number
}

interface SimNode {
  id: string
  type: 'builtin' | 'plugin'
  component: string
  state: 'idle' | 'processing' | 'error'
  messageQueue: SimMessage[]
}

interface Simulation {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  messages: SimMessage[]
  currentIndex: number
  speed: number
  resources: ResourceStore
  plugins: PluginConfig[]
  breakpoints: string[]
}
```

## Project Structure

```
src/
  engine/           # Simulation engine core
    scheduler.ts    # Built-in scheduling algorithm
    phases.ts       # Phase message generation logic
    plugin-loader.ts
  plugins/          # Built-in plugin templates
  components/       # React components
    canvas/         # React Flow canvas
    detail/         # Right detail panel
    timeline/       # Bottom timeline
    toolbar/        # Top toolbar
  store/            # Zustand state management
  types/            # TypeScript type definitions
```

## Preset Fault Scenarios

| Scenario | Trigger Point | Behavior |
|----------|---------------|----------|
| Normal creation | — | Full lifecycle success, Pod Running |
| Insufficient resources | Scheduler Filter | All Nodes out of memory, Pod stays Pending |
| Node affinity failure | Scheduler Filter | No matching Node |
| CNI failure | Kubelet → CNI | Plugin returns error, container rollback |
| CSI mount timeout | Kubelet → CSI | 60s timeout then retry |
| Image pull failure | Kubelet | ImagePullBackOff, exponential backoff |
| Operator reconcile loop | Controller | Custom logic causes resource oscillation |

## Built-in Scheduler Algorithm

- Basic K8s scheduler flow: Predicates/Filter → Priorities/Score
- 3 built-in policies: NodeResourcesFit, NodeAffinity, PodTopologySpread
- Detail panel shows per-node scoring breakdown

## Built-in CNI/CSI Templates

- CNI: Bridge mode (IP assignment, bridge setup), failure retry
- CSI: Local volume mount, NFS remote mount, provision failure
