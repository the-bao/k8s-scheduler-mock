# K8s FSM Engine Design Spec

> Actor Network + Event Bus architecture, powered by XState
> Version 1.0 — 2026-05-11

---

## 1. Overview

Replace the current procedural, pre-generated message pipeline with a **Finite State Machine (FSM) driven simulation engine**. Each K8s component becomes an independent XState Actor that communicates through an Event Bus. Messages are generated in real-time as state transitions occur, enabling dynamic branching, error recovery, and deterministic replay.

### Goals

- **Explicit state transitions** — every component state change is defined, guarded, and observable
- **Real-time message generation** — messages emerge from actor transitions, not pre-computed arrays
- **Deterministic replay** — same event sequence produces identical state (time-travel debugging)
- **Pluggable FSM engine** — XState as default, swappable to custom engine later
- **Full playback control** — step forward/backward, jump-to, variable speed, pause/resume

### Constraints

- FSM engine layer has zero K8s domain knowledge
- Actors never communicate directly — all messages go through Event Bus
- State transitions are pure functions (side effects declared in actions)
- View layer (React) never touches actors — only subscribes to ReactiveStore

---

## 2. Architecture: 5-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│  L1  Trigger Layer                                          │
│      UserAction (kubectl apply/delete/scale)                 │
│      TickClock (simulated time: probes, retries, heartbeats) │
└──────────────────────────┬──────────────────────────────────┘
                           │ dispatch(event)
┌──────────────────────────▼──────────────────────────────────┐
│  L2  MessageBus Layer                                        │
│      MessageBus (publish / route / subscribe)                │
│      EventHistory (record all events, deterministic replay)  │
│      PlaybackController (controls delivery timing)           │
└──────────────────────────┬──────────────────────────────────┘
                           │ route → Actor.mailbox
┌──────────────────────────▼──────────────────────────────────┐
│  L3  Actor Runtime Layer                                     │
│      ActorRegistry (lookup by ID, multi-instance support)    │
│      Actor<S, E> (base class: mailbox + lifecycle)           │
│      XState Machine (FSM engine per actor, pluggable)        │
└──────────────────────────┬──────────────────────────────────┘
                           │ side-effects / read-write
┌──────────────────────────▼──────────────────────────────────┐
│  L4  K8s Domain Layer                                       │
│      APIServerActor · SchedulerActor · KubeletActor           │
│      ControllerManagerActor · EtcdActor                       │
│      CRIActor · CNIActor · CSIActor                           │
│      OperatorPlugin actors (dynamic)                          │
│      EtcdStore (in-memory resource storage, versioned)        │
│      PodObject · NodeObject (pure data)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ state changes → notify
┌──────────────────────────▼──────────────────────────────────┐
│  L5  View Bridge Layer                                       │
│      ReactiveStore (adapts actor state to React)             │
│      useSyncExternalStore (React 18 standard API)            │
│      Zustand (UI state only: speed, panel tabs, selections)  │
│      FlowCanvas · Timeline · DetailPanel · Toolbar            │
└─────────────────────────────────────────────────────────────┘
```

### Layer Dependencies

| Layer | Knows about | Does NOT know about |
|-------|-------------|---------------------|
| L1 Trigger | L2 (dispatches to bus) | L3, L4, L5 |
| L2 MessageBus | L3 (routes to actors) | L1, L4, L5 |
| L3 Actor Runtime | XState FSM engine | L1, L4, L5 |
| L4 K8s Domain | L2 (bus), L3 (Actor base) | L1, L5 |
| L5 View Bridge | L4 (subscribes to state) | L1, L2, L3 |

### Invariants

1. **FSM engine is pluggable** — L3 defines the Actor interface, XState is one implementation
2. **EtcdStore separates concerns** — K8s resources live in EtcdStore (L4), not in Zustand
3. **Deterministic replay** — same event sequence → same state
4. **TickClock decouples time** — no real timers in actors, all time-driven behavior uses TICK events

---

## 3. L2: MessageBus Layer

### MessageBus

All actor communication goes through the MessageBus.

```typescript
interface MessageBus {
  publish(event: SimEvent): void    // broadcast to all subscribers of event.type
  route(to: string, event: SimEvent): void  // deliver to specific actor
  subscribe(type: string, handler: (e: SimEvent) => void): () => void
}
```

- `publish` for broadcast events (POD_CREATED, POD_RUNNING, etc.)
- `route` for targeted delivery (e.g., API Server → specific Kubelet by node name)

### EventHistory

Records every event flowing through the bus.

```typescript
interface EventHistory {
  record(event: SimEvent): void
  getAll(): SimEvent[]
  getUpTo(index: number): SimEvent[]
  replay(actors: Actor[], upToIndex: number): void  // deterministic replay from scratch
  clear(): void
}
```

Replay resets all actors to initial state, then sequentially delivers events 0..upToIndex. Because FSM transitions are deterministic, the result matches the original run exactly.

### PlaybackController

Controls simulation flow — when events are delivered from the buffer.

**FSM States:** `idle | running | paused | completed | stepping`

**Transitions:**

```
idle ──[PLAY]──→ running
idle ──[STEP_FORWARD]──→ stepping
idle ──[LOAD_SCENARIO]──→ idle   (reset all actors, load scenario)

running ──[TICK]──→ running      (deliver next event, take snapshot)
running ──[PAUSE]──→ paused
running ──[RESET]──→ idle
running ──[no more events]──→ completed

paused ──[PLAY]──→ running
paused ──[STEP_FORWARD]──→ stepping
paused ──[STEP_BACKWARD]──→ stepping   (restore previous snapshot)
paused ──[JUMP_TO(n)]──→ stepping      (restore snapshot at index n)
paused ──[RESET]──→ idle

stepping ──[DELIVERED]──→ paused       (one event delivered, auto-pause)

completed ──[RESET]──→ idle
completed ──[JUMP_TO(n)]──→ stepping
```

**Speed control:** TICK interval = `baseInterval / speed` (0.5x=2s, 1x=1s, 2x=500ms, 5x=200ms)

**Snapshot strategy:**
- Snapshot = `{ all actor states, EtcdStore data, event log index }`
- Taken after every event delivery
- Ring buffer, max 500 snapshots (oldest discarded)

---

## 4. L3: Actor Runtime Layer

### ActorRegistry

```typescript
interface ActorRegistry {
  register(actor: Actor): void
  lookup(actorId: string): Actor | undefined
  getAll(): Actor[]
  getByType(component: string): Actor[]
}
```

Supports multiple instances of the same type (e.g., `kubelet:node-1`, `kubelet:node-2`).

### Actor Base

Each actor has:
- **Private state** — external code cannot read/write directly
- **Mailbox** — FIFO event queue, sequential consumption
- **XState machine** — FSM engine instance
- **makeCtx()** — builds execution context with actor's private data + bus reference
- **onTransition()** — called after each state change, typically publishes status events

```typescript
abstract class Actor<S extends string, E extends string> {
  readonly id: string
  private fsm: XStateMachine<S, E>
  private mailbox: SimEvent[] = []
  private draining = false

  receive(event: SimEvent): void       // enqueue to mailbox
  private drain(): void                 // process mailbox sequentially
  getState(): S
  reset(): void                         // reset FSM + clear mailbox

  abstract makeCtx(): ActorContext
  protected abstract onTransition(state: S, event: SimEvent): void
}
```

**Mailbox draining** prevents re-entrant processing:
```
while mailbox not empty:
  dequeue head event
  send to FSM → get new state
  if state changed → onTransition(newState, event)
```

---

## 5. L4: K8s Domain Actor Definitions

### 5.1 EtcdActor

**States:** `idle | writing | reading`

| Transition | Trigger | Target | Action |
|------------|---------|--------|--------|
| idle → writing | WRITE_REQUEST | writing | Store value in memory Map, increment revision, emit WRITE_RESPONSE |
| writing → idle | (auto) | idle | Publish WATCH_EVENT for key prefix subscribers |
| idle → reading | READ_REQUEST | reading | Lookup from map, emit READ_RESPONSE |
| reading → idle | (auto) | idle | — |

**Watch mechanism:** When a key is written, all subscribers of that key prefix receive a WATCH_EVENT. This drives the phase transitions between components.

**Subscriptions:**
- `/registry/pods/*` → SchedulerActor, ControllerManagerActor
- `/registry/pods/{nodeName}/*` → KubeletActor (matched by node)

### 5.2 APIServerActor

**States:** `idle | validating | storing | broadcasting | updating`

| Transition | Trigger | Guard | Target | Action |
|------------|---------|-------|--------|--------|
| idle → validating | USER_APPLY | — | validating | Validate manifest |
| validating → storing | VALID_OK | — | storing | Route WRITE_REQUEST to Etcd |
| validating → idle | VALID_FAIL | — | idle | Publish ERROR_RESPONSE to user |
| storing → broadcasting | WRITE_OK | — | broadcasting | Publish POD_CREATED/UPDATED |
| storing → idle | WRITE_FAIL | — | idle | Publish ERROR_RESPONSE |
| broadcasting → idle | (auto) | — | idle | — |
| idle → updating | BIND_REQUEST | — | updating | Update pod.nodeName, write to Etcd, publish POD_BOUND |
| idle → updating | STATUS_UPDATE | — | updating | Update pod.status, write to Etcd, publish POD_UPDATED |
| updating → idle | (auto) | — | idle | — |

**Emitted events:**

| Event | Target | Trigger |
|-------|--------|---------|
| POD_CREATED | broadcast (Scheduler, ControllerMgr) | New pod written to etcd |
| POD_BOUND | route (matching Kubelet) | Bind request processed |
| POD_UPDATED | broadcast | Pod status/spec updated |
| ERROR_RESPONSE | route (User) | Validation or storage failure |

### 5.3 SchedulerActor

**States:** `idle | filtering | scoring | binding | error`

| Transition | Trigger | Guard | Target | Action |
|------------|---------|-------|--------|--------|
| idle → filtering | POD_PENDING | — | filtering | Load pod spec, run filter plugins |
| filtering → scoring | FILTER_DONE | candidates > 0 | scoring | Run score plugins |
| filtering → idle | FILTER_DONE | candidates = 0 | idle | Publish POD_UNSCHEDULABLE |
| filtering → error | FILTER_ERROR | — | error | Publish POD_UNSCHEDULABLE |
| scoring → binding | SCORE_DONE | best score > 0 | binding | Route BIND_REQUEST to API-Server |
| scoring → idle | SCORE_DONE | all scores = 0 | idle | Publish POD_UNSCHEDULABLE |
| binding → idle | BIND_OK | — | idle | — |
| binding → idle | BIND_FAIL | — | idle | Requeue: publish POD_PENDING |
| binding → binding | TICK | timeout | binding | Publish BIND_FAIL to self |
| error → idle | TICK | backoff elapsed | idle | Requeue pod |

**Context data:** `pendingPod`, `candidates: NodeObject[]`, `scores: Map<string, number>`, `filterPlugins: FilterPlugin[]`

**Filter plugins are extensible:** add a `FilterPlugin` implementation and register it with the actor.

### 5.4 ControllerManagerActor

**States:** `watching | reconciling | updating | error`

| Transition | Trigger | Target | Action |
|------------|---------|--------|--------|
| watching → reconciling | POD_CREATED | reconciling | Compute desired vs actual replicas |
| watching → reconciling | POD_UPDATED | reconciling | Recompute state |
| watching → reconciling | POD_FAILED | reconciling | Diff = desired - actual |
| watching → reconciling | CRD_ADDED | reconciling | Dispatch to matching controller, BFS chain reconcile (depth ≤ 3) |
| reconciling → updating | diff > 0 | updating | Publish CREATE_POD / DELETE_POD per diff |
| reconciling → watching | diff = 0 | watching | Nothing to do |
| updating → watching | UPDATE_DONE | watching | — |
| updating → error | UPDATE_FAIL | error | — |
| error → watching | TICK | watching | Backoff, re-watch |

**Managed controllers (strategy objects inside this actor):**
- DeploymentController
- ReplicaSetController
- DaemonSetController
- JobController
- CronJobController
- Custom operators from PluginEditor (registered at runtime)

**Operator chain reconcile (BFS):** For non-Pod resources (e.g., Deployment), the controller dispatches to the matching controller, which creates a new resource (e.g., ReplicaSet), which triggers the next controller in chain. Depth capped at 3 to prevent infinite loops.

### 5.5 KubeletActor (per node)

Each node gets its own instance: `kubelet:node-1`, `kubelet:node-2`, etc.

**States:** `idle | creating_sandbox | settingup_network | mounting_volumes | pulling_image | starting_container | running | restarting | terminating | error`

**Happy path:**

| Transition | Trigger | Target | Action |
|------------|---------|--------|--------|
| idle → creating_sandbox | POD_BOUND | creating_sandbox | Route CREATE_SANDBOX to CRI |
| creating_sandbox → settingup_network | SANDBOX_OK | settingup_network | Route CNI_SETUP to CNI |
| creating_sandbox → error | SANDBOX_FAIL | error | Publish POD_FAILED |
| settingup_network → mounting_volumes | CNI_OK | mounting_volumes | Route CSI_STAGE + CSI_PUBLISH to CSI |
| settingup_network → error | CNI_FAIL | error | Publish POD_FAILED |
| mounting_volumes → pulling_image | CSI_OK | pulling_image | Route PULL_IMAGE to CRI |
| mounting_volumes → error | CSI_FAIL | error | Publish POD_FAILED |
| pulling_image → starting_container | PULL_OK | starting_container | Route START_CONTAINER to CRI |
| pulling_image → error | PULL_FAIL | error | Publish POD_FAILED |
| starting_container → running | START_OK | running | Publish POD_RUNNING, update status in etcd |
| starting_container → error | START_FAIL | error | Publish POD_FAILED |

**Running phase:**

| Transition | Trigger | Guard | Target | Action |
|------------|---------|-------|--------|--------|
| running → running | TICK | probe OK | running | — |
| running → running | TICK | probe fail | running | Emit PROBE_FAIL to self |
| running → restarting | PROBE_FAIL | — | restarting | Restart container |
| restarting → running | TICK | restart OK | running | — |
| restarting → error | TICK | retry exceeded | error | Publish POD_FAILED |
| running → terminating | POD_DELETED | — | terminating | Cleanup CNI, CSI, CRI (reverse order) |
| terminating → idle | (auto) | — | idle | — |

**Error recovery:**

| Transition | Trigger | Target | Action |
|------------|---------|--------|--------|
| error → idle | TICK | backoff elapsed | Publish POD_FAILED, controller will reconcile |

### 5.6 CRIActor / CNIActor / CSIActor

All three share the same FSM shape — simple request/response pattern.

**States:** `idle | processing`

| Transition | Trigger | Target | Action |
|------------|---------|--------|--------|
| idle → processing | \<OPERATION\> | processing | Execute operation |
| processing → idle | (auto) | idle | Emit \<OPERATION\>_OK or \<OPERATION\>_FAIL |

**CRIActor operations:** CREATE_SANDBOX, PULL_IMAGE, START_CONTAINER
**CNIActor operations:** CNI_SETUP
**CSIActor operations:** CSI_STAGE_VOLUME, CSI_PUBLISH_VOLUME

**Fault injection:** Scenario errors are injected by publishing `*_FAIL` instead of `*_OK` when the scenario config matches the current operation type.

---

## 6. L1: Trigger Layer

### UserAction

Maps user interactions (kubectl apply, delete, scale) to events dispatched to the MessageBus.

```typescript
interface UserAction {
  type: 'APPLY' | 'DELETE' | 'SCALE'
  manifest: Record<string, unknown>
}
```

### TickClock

Drives all time-based behavior. Emits TICK events at a configurable interval controlled by PlaybackController speed settings.

- Health probes (KubeletActor running state)
- Retry backoff (SchedulerActor, ControllerManagerActor error recovery)
- CronJob triggers (ControllerManagerActor)
- Node heartbeat (KubeletActor → API-Server)

---

## 7. L5: View Bridge Layer

### ReactiveStore

Subscribes to actor state changes and exposes a React-consumable snapshot.

```typescript
interface ClusterState {
  actors: Record<string, { state: string; updatedAt: number }>
  pods: Record<string, PodObject>
  nodes: Record<string, NodeObject>
  events: SimEvent[]    // event log for detail panel
}
```

Integrated with React via `useSyncExternalStore`:

```typescript
const useClusterState = () =>
  useSyncExternalStore(reactiveStore.subscribe, reactiveStore.getSnapshot)
```

### Zustand (demoted)

Zustand is retained only for pure UI state that has nothing to do with K8s simulation:
- Selected panel tab (Request/Logs/Status)
- Toolbar dropdown state
- Plugin editor modal open/closed
- Simulation speed setting

All K8s domain state (pods, nodes, events, actor states) lives in ReactiveStore, not Zustand.

---

## 8. Data Objects

### EtcdStore

In-memory Map with version numbers, simulating etcd's key-value store.

```typescript
interface EtcdStore {
  get(key: string): { value: unknown; revision: number } | undefined
  set(key: string, value: unknown): number  // returns new revision
  delete(key: string): boolean
  list(prefix: string): Array<{ key: string; value: unknown; revision: number }>
  subscribe(prefix: string, handler: (event: WatchEvent) => void): () => void
}
```

### PodObject

```typescript
interface PodObject {
  name: string
  namespace: string
  nodeName: string | null       // null = unscheduled
  phase: 'Pending' | 'Scheduled' | 'Running' | 'Succeeded' | 'Failed'
  conditions: PodCondition[]
  spec: {
    containers: ContainerSpec[]
    resources: ResourceRequirements
  }
}
```

### NodeObject

```typescript
interface NodeObject {
  name: string
  ready: boolean
  allocatable: { cpu: number; mem: number }
  used: { cpu: number; mem: number }
  labels: Record<string, string>
  taints: Taint[]
}
```

---

## 9. Directory Structure

```
src/
  engine/
    fsm/                          # L3: Actor Runtime Layer
      types.ts                    # ActorContext, SimEvent, FSM types
      actor.ts                    # Actor base class
      registry.ts                 # ActorRegistry
      xstate-adapter.ts           # XState integration adapter
    bus/                          # L2: MessageBus Layer
      message-bus.ts              # MessageBus (publish/route/subscribe)
      event-history.ts            # EventHistory (record + replay)
      playback-controller.ts      # PlaybackController FSM
    trigger/                      # L1: Trigger Layer
      user-action.ts              # UserAction dispatcher
      tick-clock.ts               # TickClock (simulated time)
    store/                        # L4: Data Layer
      etcd-store.ts               # In-memory etcd simulation
      reactive-store.ts           # L5: View bridge
    actors/                       # L4: K8s Domain Actors
      api-server-actor.ts
      etcd-actor.ts
      scheduler-actor.ts
      controller-manager-actor.ts
      kubelet-actor.ts
      cri-actor.ts
      cni-actor.ts
      csi-actor.ts
      plugins/                    # Dynamic plugin actors
        operator-plugin-actor.ts
      operators/                  # Controller strategy objects
        deployment-controller.ts
        replicaset-controller.ts
        daemonset-controller.ts
        job-controller.ts
        cronjob-controller.ts
    __tests__/                    # Tests for each layer
```

---

## 10. Migration Strategy

The migration replaces the existing engine/ and store/ modules. Key mapping:

| Current | New |
|---------|-----|
| `engine/simulation.ts` (generateMessages) | Removed — messages generated by actor transitions |
| `engine/phases/submit.ts` | APIServerActor + EtcdActor transitions |
| `engine/phases/controller.ts` | ControllerManagerActor transitions |
| `engine/phases/operator.ts` | ControllerManagerActor BFS chain reconcile |
| `engine/phases/scheduling.ts` | SchedulerActor transitions |
| `engine/phases/kubelet.ts` | KubeletActor + CRI/CNI/CSI actor transitions |
| `engine/operators/*` | Strategy objects inside ControllerManagerActor |
| `store/simulation-store.ts` | ReactiveStore + Zustand (UI state only) |
| `types/simulation.ts` | Split across `engine/fsm/types.ts` and `engine/store/` |

**Migration phases:**

1. Build L3 (Actor base, Registry) + L2 (MessageBus, EventHistory, PlaybackController) — no K8s logic
2. Build EtcdStore and ReactiveStore
3. Implement actors one at a time: EtcdActor → APIServerActor → SchedulerActor → ControllerManagerActor → KubeletActor → CRI/CNI/CSI
4. Wire PlaybackController to existing Timeline UI
5. Wire ReactiveStore to existing FlowCanvas + DetailPanel
6. Remove old engine/ and simulation-store code
7. Migrate scenarios to new format (trigger events instead of pre-generated messages)

---

## 11. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| FSM engine | XState (pluggable) | Rich tooling, visualizer, inspector. Can swap later. |
| Actor communication | Event Bus (pub/sub) | Decouples actors, enables deterministic replay |
| Playback mechanism | Event buffer + snapshots | Best balance of forward/backward/jump-to |
| Time source | TickClock (explicit TICK events) | No real timers in actors, fully controllable, deterministic |
| etcd simulation | In-memory Map + versioning | Simple, sufficient for simulation |
| Controller pattern | Strategy objects in ControllerManagerActor | Mirrors real K8s (one process, multiple loops) |
| View bridge | ReactiveStore + useSyncExternalStore | Standard React 18 API, no Zustand for domain state |
| Snapshot limit | 500 (ring buffer) | Prevents unbounded memory growth |
| Operator chain depth | ≤ 3 | Prevents infinite reconciliation loops |
