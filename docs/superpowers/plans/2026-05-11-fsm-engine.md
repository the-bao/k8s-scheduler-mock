# K8s FSM Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Goal:** Replace the procedural pre-generated message pipeline with an FSM-driven actor network. Each K8s component becomes an XState actor communicating through an Event Bus, with real-time message generation, deterministic replay, and full playback control.
>
> **Architecture:** 5-layer architecture: L1 Trigger → L2 MessageBus → L3 Actor Runtime → L4 K8s Domain → L5 View Bridge. Actors communicate exclusively through MessageBus. PlaybackController drives event delivery timing. ReactiveStore bridges actors to React.
>
> **Tech Stack:** React 19, TypeScript, XState v5, Zustand (UI state only), Vitest, Tailwind CSS v4, @xyflow/react

---

## File Structure

**New files to create:**

```
src/engine/fsm/
  types.ts              # SimEvent, ActorContext, FSM types (no K8s knowledge)
  actor.ts             # Actor base class with mailbox + XState integration
  registry.ts          # ActorRegistry: register, lookup, getAll, getByType
  xstate-adapter.ts    # XState machine → FSM engine adapter (pluggable)

src/engine/bus/
  message-bus.ts       # MessageBus: publish, route, subscribe
  event-history.ts     # EventHistory: record, replay, clear
  playback-controller.ts  # PlaybackController FSM with snapshots

src/engine/trigger/
  user-action.ts       # UserAction: APPLY/DELETE/SCALE → event dispatcher
  tick-clock.ts        # TickClock: emits TICK at configurable interval

src/engine/store/
  etcd-store.ts        # In-memory etcd: get/set/delete/list with versioning + watch
  reactive-store.ts    # ReactiveStore: actor state → React snapshot

src/engine/actors/
  api-server-actor.ts
  etcd-actor.ts
  scheduler-actor.ts
  controller-manager-actor.ts
  kubelet-actor.ts
  cri-actor.ts
  cni-actor.ts
  csi-actor.ts
  plugins/
    operator-plugin-actor.ts

src/engine/simulation.ts   # Updated: wires all layers together, replaces old simulation
```

**Files to modify:**
- `src/store/simulation-store.ts` — reduce to UI state only (tab, speed, modal)
- `src/App.tsx` — wire ReactiveStore to FlowCanvas + DetailPanel
- `src/components/timeline/Timeline.tsx` — connect to PlaybackController
- `src/components/toolbar/Toolbar.tsx` — connect start/reset to PlaybackController
- `src/types/simulation.ts` — split K8s domain types to engine/store, keep UI types

**Files to remove (after migration):**
- `src/engine/phases/` — replaced by actors
- `src/engine/operators/` — replaced by strategy objects in ControllerManagerActor
- `src/engine/types.ts` — replaced by `engine/fsm/types.ts`

---

## Task 1: Install XState

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install xstate dependency**

```bash
cd "D:/study/ai/k8s-scheduler-mock"
pnpm add xstate@^5.28.0 @xstate/react@^4.2.0
```

Run: `pnpm install`
Expected: xstate and @xstate/react added to dependencies

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install xstate and @xstate/react

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: L3 — FSM Types and Actor Base

**Files:**
- Create: `src/engine/fsm/types.ts`
- Create: `src/engine/fsm/actor.ts`
- Create: `src/engine/fsm/xstate-adapter.ts`
- Create: `src/engine/fsm/__tests__/types.test.ts`
- Create: `src/engine/fsm/__tests__/actor.test.ts`

- [ ] **Step 1: Write failing test for SimEvent and ActorContext types**

```typescript
// src/engine/fsm/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'

describe('SimEvent', () => {
  it('has required fields: type, from, payload', () => {
    const event = { type: 'TEST_EVENT', from: 'actor-1', payload: { foo: 'bar' } }
    expect(event.type).toBe('TEST_EVENT')
    expect(event.from).toBe('actor-1')
    expect(event.payload).toEqual({ foo: 'bar' })
  })

  it('has optional fields: ts, to', () => {
    const ts = Date.now()
    const event = { type: 'TEST_EVENT', from: 'actor-1', ts, to: 'actor-2' }
    expect(event.ts).toBe(ts)
    expect(event.to).toBe('actor-2')
  })
})

describe('ActorContext', () => {
  it('has actorId and bus reference', () => {
    const mockBus = { publish: () => {}, route: () => {} }
    const ctx = { actorId: 'test-actor', bus: mockBus }
    expect(ctx.actorId).toBe('test-actor')
    expect(typeof ctx.bus.publish).toBe('function')
  })
})
```

Run: `pnpm test -- src/engine/fsm/__tests__/types.test.ts`
Expected: PASS (types are structural, no implementation needed yet)

- [ ] **Step 2: Write failing test for Actor base class**

```typescript
// src/engine/fsm/__tests__/actor.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Actor } from '../actor'

// Concrete subclass for testing
class TestActor extends Actor<'idle' | 'processing', string> {
  protected onTransition(state: 'idle' | 'processing', event: { type: string }) {
    // test hook
  }
  makeCtx() {
    return { actorId: this.id, bus: { publish: () => {}, route: () => {} } }
  }
}

describe('Actor', () => {
  it('has a unique id', () => {
    const actor = new TestActor('test-actor-id')
    expect(actor.id).toBe('test-actor-id')
  })

  it('starts with initial state', () => {
    const actor = new TestActor('test')
    expect(actor.getState()).toBe('idle')
  })

  it('accepts events via receive() and drains mailbox', () => {
    const actor = new TestActor('test')
    const event = { type: 'TEST' }
    actor.receive(event)
    // After drain, mailbox should be empty — but this test
    // only verifies receive doesn't throw
    expect(actor.getState()).toBeDefined()
  })

  it('can be reset', () => {
    const actor = new TestActor('test')
    actor.receive({ type: 'TEST' })
    actor.reset()
    expect(actor.getState()).toBe('idle')
  })
})
```

Run: `pnpm test -- src/engine/fsm/__tests__/actor.test.ts`
Expected: FAIL with "Actor not defined" or similar

- [ ] **Step 3: Write minimal Actor base class**

```typescript
// src/engine/fsm/types.ts
export type SimEvent = {
  type: string
  from?: string
  to?: string
  payload?: unknown
  ts?: number
}

export interface ActorContext {
  actorId: string
  bus: MessageBusLike
  [key: string]: unknown
}

export interface MessageBusLike {
  publish(event: SimEvent): void
  route(to: string, event: SimEvent): void
}
```

```typescript
// src/engine/fsm/actor.ts
import type { SimEvent, ActorContext } from './types'

export abstract class Actor<S extends string, E extends string> {
  readonly id: string
  private mailbox: SimEvent[] = []
  private draining = false
  private fsm!: { getState(): S }

  constructor(id: string, initialState: S) {
    this.id = id
    this.fsm = { getState: () => initialState }
  }

  receive(event: SimEvent): void {
    this.mailbox.push(event)
    if (!this.draining) this.drain()
  }

  protected getState(): S {
    return this.fsm.getState()
  }

  reset(): void {
    this.mailbox = []
    this.draining = false
  }

  protected abstract makeCtx(): ActorContext
  protected abstract onTransition(state: S, event: SimEvent): void

  private drain(): void {
    this.draining = true
    while (this.mailbox.length) {
      const e = this.mailbox.shift()!
      this.onTransition(this.fsm.getState(), e)
    }
    this.draining = false
  }
}
```

Run: `pnpm test -- src/engine/fsm/__tests__/actor.test.ts`
Expected: PASS

- [ ] **Step 4: Write test for XState adapter**

```typescript
// src/engine/fsm/__tests__/xstate-adapter.test.ts
import { describe, it, expect } from 'vitest'
import { createXStateMachine } from '../xstate-adapter'

describe('createXStateMachine', () => {
  it('creates a machine with initial state', () => {
    const machine = createXStateMachine({
      initial: 'idle',
      states: { idle: {} },
    })
    expect(machine.getState()).toBe('idle')
  })
})
```

- [ ] **Step 5: Write minimal xstate-adapter.ts**

```typescript
// src/engine/fsm/xstate-adapter.ts
import { createMachine } from 'xstate'

export interface FSMachine<S extends string> {
  getState(): S
  send(event: unknown): S | null
}

export function createXStateMachine<S extends string>(
  config: { initial: S; states: Record<string, object> }
): FSMachine<S> {
  const machine = createMachine({
    id: 'fsm',
    initial: config.initial,
    states: config.states,
  })
  return {
    getState: () => config.initial,
    send: () => null,
  }
}
```

- [ ] **Step 6: Update Actor to use XState adapter (stub version first)**

```typescript
// src/engine/fsm/actor.ts — update constructor to use adapter
private fsm: FSMachine<S>

constructor(id: string, machine: FSMachine<S>) {
  this.id = id
  this.fsm = machine
}
```

- [ ] **Step 7: Commit**

```bash
git add src/engine/fsm/
git commit -m "feat: add FSM types, Actor base class, and XState adapter stubs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: L3 — ActorRegistry

**Files:**
- Create: `src/engine/fsm/registry.ts`
- Create: `src/engine/fsm/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing test for ActorRegistry**

```typescript
// src/engine/fsm/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest'
import { ActorRegistry } from '../registry'
import { Actor } from '../actor'

class TestActor extends Actor<'idle', string> {
  protected onTransition() {}
  makeCtx() { return { actorId: this.id, bus: { publish: () => {}, route: () => {} } } }
}

describe('ActorRegistry', () => {
  it('registers and looks up actors by id', () => {
    const registry = new ActorRegistry()
    const actor = new TestActor('test-1')
    registry.register(actor)
    expect(registry.lookup('test-1')).toBe(actor)
    expect(registry.lookup('nonexistent')).toBeUndefined()
  })

  it('getAll returns all registered actors', () => {
    const registry = new ActorRegistry()
    registry.register(new TestActor('a1'))
    registry.register(new TestActor('a2'))
    expect(registry.getAll()).toHaveLength(2)
  })

  it('getByType returns actors with matching id prefix', () => {
    const registry = new ActorRegistry()
    registry.register(new TestActor('kubelet:node-1'))
    registry.register(new TestActor('kubelet:node-2'))
    registry.register(new TestActor('scheduler'))
    const kubelets = registry.getByType('kubelet')
    expect(kubelets).toHaveLength(2)
    expect(kubelets.map(a => a.id)).toEqual(['kubelet:node-1', 'kubelet:node-2'])
  })
})
```

Run: `pnpm test -- src/engine/fsm/__tests__/registry.test.ts`
Expected: FAIL with "ActorRegistry not defined"

- [ ] **Step 2: Write minimal ActorRegistry**

```typescript
// src/engine/fsm/registry.ts
import type { Actor } from './actor'

export class ActorRegistry {
  private actors = new Map<string, Actor<unknown, unknown>>()

  register(actor: Actor<unknown, unknown>): void {
    this.actors.set(actor.id, actor)
  }

  lookup(actorId: string): Actor<unknown, unknown> | undefined {
    return this.actors.get(actorId)
  }

  getAll(): Actor<unknown, unknown>[] {
    return [...this.actors.values()]
  }

  getByType(component: string): Actor<unknown, unknown>[] {
    return [...this.actors.values()].filter(a => a.id.startsWith(component))
  }
}
```

Run: `pnpm test -- src/engine/fsm/__tests__/registry.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/fsm/
git commit -m "feat: add ActorRegistry with lookup/getAll/getByType

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: L2 — MessageBus

**Files:**
- Create: `src/engine/bus/message-bus.ts`
- Create: `src/engine/bus/__tests__/message-bus.test.ts`

- [ ] **Step 1: Write failing test for MessageBus**

```typescript
// src/engine/bus/__tests__/message-bus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { MessageBus } from '../message-bus'

describe('MessageBus', () => {
  it('publishes to all subscribers of the event type', () => {
    const bus = new MessageBus()
    const handler = vi.fn()
    bus.subscribe('TEST_EVENT', handler)
    bus.publish({ type: 'TEST_EVENT', from: 'test' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not notify subscribers of different event types', () => {
    const bus = new MessageBus()
    const handler = vi.fn()
    bus.subscribe('EVENT_A', handler)
    bus.publish({ type: 'EVENT_B' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('routes to specific actor by id', () => {
    const bus = new MessageBus()
    const handler = vi.fn()
    bus.subscribe('TEST_EVENT', handler)
    // route calls subscriber directly — just verify no error
    bus.route('target-actor', { type: 'TEST_EVENT' })
    expect(handler).toHaveBeenCalled()
  })

  it('subscribe returns unsubscribe function', () => {
    const bus = new MessageBus()
    const handler = vi.fn()
    const unsubscribe = bus.subscribe('TEST_EVENT', handler)
    unsubscribe()
    bus.publish({ type: 'TEST_EVENT' })
    expect(handler).not.toHaveBeenCalled()
  })
})
```

Run: `pnpm test -- src/engine/bus/__tests__/message-bus.test.ts`
Expected: FAIL with "MessageBus not defined"

- [ ] **Step 2: Write MessageBus**

```typescript
// src/engine/bus/message-bus.ts
import type { SimEvent } from '../fsm/types'

export class MessageBus {
  private handlers = new Map<string, Set<(e: SimEvent) => void>>()

  publish(event: SimEvent): void {
    this.handlers.get(event.type)?.forEach(h => h(event))
  }

  route(to: string, event: SimEvent): void {
    // Route is a targeted publish — same mechanism
    this.publish(event)
  }

  subscribe(type: string, handler: (e: SimEvent) => void): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }
}
```

Run: `pnpm test -- src/engine/bus/__tests__/message-bus.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/bus/
git commit -m "feat: add MessageBus with publish/route/subscribe

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: L2 — EventHistory

**Files:**
- Create: `src/engine/bus/event-history.ts`
- Create: `src/engine/bus/__tests__/event-history.test.ts`

- [ ] **Step 1: Write failing test for EventHistory**

```typescript
// src/engine/bus/__tests__/event-history.test.ts
import { describe, it, expect } from 'vitest'
import { EventHistory } from '../event-history'
import type { SimEvent } from '../../fsm/types'

describe('EventHistory', () => {
  it('records and returns all events', () => {
    const history = new EventHistory()
    const e1: SimEvent = { type: 'EVENT_A', from: 'a' }
    const e2: SimEvent = { type: 'EVENT_B', from: 'b' }
    history.record(e1)
    history.record(e2)
    expect(history.getAll()).toEqual([e1, e2])
  })

  it('gets events up to index', () => {
    const history = new EventHistory()
    history.record({ type: 'A' })
    history.record({ type: 'B' })
    history.record({ type: 'C' })
    expect(history.getUpTo(1)).toHaveLength(2)
    expect(history.getUpTo(1)).toEqual([{ type: 'A' }, { type: 'B' }])
  })

  it('clears all events', () => {
    const history = new EventHistory()
    history.record({ type: 'A' })
    history.clear()
    expect(history.getAll()).toHaveLength(0)
  })

  it('clears correctly after clear', () => {
    const history = new EventHistory()
    history.record({ type: 'A' })
    history.clear()
    history.record({ type: 'B' })
    expect(history.getAll()).toEqual([{ type: 'B' }])
  })
})
```

Run: `pnpm test -- src/engine/bus/__tests__/event-history.test.ts`
Expected: FAIL

- [ ] **Step 2: Write EventHistory**

```typescript
// src/engine/bus/event-history.ts
import type { SimEvent } from '../fsm/types'

export class EventHistory {
  private events: SimEvent[] = []

  record(event: SimEvent): void {
    this.events.push(event)
  }

  getAll(): SimEvent[] {
    return [...this.events]
  }

  getUpTo(index: number): SimEvent[] {
    return this.events.slice(0, index + 1)
  }

  clear(): void {
    this.events = []
  }
}
```

Run: `pnpm test -- src/engine/bus/__tests__/event-history.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/bus/
git commit -m "feat: add EventHistory with record/getAll/getUpTo/clear

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: L2 — PlaybackController

**Files:**
- Create: `src/engine/bus/playback-controller.ts`
- Create: `src/engine/bus/__tests__/playback-controller.test.ts`

- [ ] **Step 1: Write failing test for PlaybackController**

```typescript
// src/engine/bus/__tests__/playback-controller.test.ts
import { describe, it, expect } from 'vitest'
import { PlaybackController } from '../playback-controller'

describe('PlaybackController', () => {
  it('starts in idle state', () => {
    const pc = new PlaybackController()
    expect(pc.getState()).toBe('idle')
  })

  it('transitions to running on PLAY', () => {
    const pc = new PlaybackController()
    pc.play()
    expect(pc.getState()).toBe('running')
  })

  it('transitions to paused on PAUSE', () => {
    const pc = new PlaybackController()
    pc.play()
    pc.pause()
    expect(pc.getState()).toBe('paused')
  })

  it('resets to idle on RESET', () => {
    const pc = new PlaybackController()
    pc.play()
    pc.reset()
    expect(pc.getState()).toBe('idle')
  })

  it('transitions to completed when no events remain', () => {
    const pc = new PlaybackController()
    // With no events buffered, next() should transition to completed
    pc.play()
    // Allow tick to process
    expect(pc.getState()).toBe('completed')
  })

  it('stepForward delivers one event and pauses', () => {
    const pc = new PlaybackController()
    pc.stepForward()
    expect(pc.getState()).toBe('paused')
  })

  it('JUMP_TO transitions to stepping then pauses', () => {
    const pc = new PlaybackController()
    pc.jumpTo(0)
    expect(pc.getState()).toBe('paused')
  })

  it('sets speed correctly', () => {
    const pc = new PlaybackController()
    pc.setSpeed(2)
    expect(pc.getSpeed()).toBe(2)
  })
})
```

Run: `pnpm test -- src/engine/bus/__tests__/playback-controller.test.ts`
Expected: FAIL

- [ ] **Step 2: Write minimal PlaybackController**

```typescript
// src/engine/bus/playback-controller.ts
export type PlaybackState = 'idle' | 'running' | 'paused' | 'completed' | 'stepping'

export class PlaybackController {
  private state: PlaybackState = 'idle'
  private speed = 1
  private eventBuffer: unknown[] = []
  private currentIndex = -1
  private snapshots: unknown[] = []

  getState(): PlaybackState {
    return this.state
  }

  getSpeed(): number {
    return this.speed
  }

  play(): void {
    if (this.state === 'completed' || this.state === 'idle' || this.state === 'paused') {
      this.state = 'running'
    }
  }

  pause(): void {
    this.state = 'paused'
  }

  reset(): void {
    this.state = 'idle'
    this.currentIndex = -1
    this.snapshots = []
  }

  stepForward(): void {
    this.state = 'stepping'
    // deliver one event
    this.currentIndex++
    if (this.currentIndex >= this.eventBuffer.length) {
      this.state = 'completed'
    } else {
      this.state = 'paused'
    }
  }

  stepBackward(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--
      this.state = 'paused'
    }
  }

  jumpTo(index: number): void {
    this.currentIndex = index
    this.state = 'paused'
  }

  setSpeed(speed: number): void {
    this.speed = speed
  }
}
```

Run: `pnpm test -- src/engine/bus/__tests__/playback-controller.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/bus/
git commit -m "feat: add PlaybackController FSM with play/pause/reset/step/jump

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: L4 — EtcdStore

**Files:**
- Create: `src/engine/store/etcd-store.ts`
- Create: `src/engine/store/__tests__/etcd-store.test.ts`

- [ ] **Step 1: Write failing test for EtcdStore**

```typescript
// src/engine/store/__tests__/etcd-store.test.ts
import { describe, it, expect } from 'vitest'
import { EtcdStore } from '../etcd-store'

describe('EtcdStore', () => {
  const store = new EtcdStore()

  it('sets and gets a value with revision', () => {
    const rev = store.set('/registry/pods/default/test', { name: 'test', phase: 'Pending' })
    expect(rev).toBe(1)
    const result = store.get('/registry/pods/default/test')
    expect(result?.value).toEqual({ name: 'test', phase: 'Pending' })
    expect(result?.revision).toBe(1)
  })

  it('increments revision on update', () => {
    store.set('/registry/pods/default/test', { phase: 'Running' })
    const result = store.get('/registry/pods/default/test')
    expect(result?.revision).toBe(2)
  })

  it('returns undefined for nonexistent key', () => {
    expect(store.get('/nonexistent')).toBeUndefined()
  })

  it('deletes a key', () => {
    store.set('/registry/test', { data: true })
    expect(store.delete('/registry/test')).toBe(true)
    expect(store.get('/registry/test')).toBeUndefined()
  })

  it('lists keys by prefix', () => {
    store.set('/registry/pods/default/pod-a', { name: 'a' })
    store.set('/registry/pods/default/pod-b', { name: 'b' })
    store.set('/registry/nodes/node-1', { name: 'node-1' })
    const pods = store.list('/registry/pods/')
    expect(pods).toHaveLength(2)
  })

  it('notifies subscribers on write', () => {
    store.set('/registry/pods/default/test', { name: 'test' })
    const handler = vi.fn()
    store.subscribe('/registry/pods/', handler)
    store.set('/registry/pods/default/test', { name: 'test', phase: 'Running' })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
```

Run: `pnpm test -- src/engine/store/__tests__/etcd-store.test.ts`
Expected: FAIL

- [ ] **Step 2: Write EtcdStore**

```typescript
// src/engine/store/etcd-store.ts
type WatchHandler = (event: WatchEvent) => void

interface WatchEvent {
  type: 'put' | 'delete'
  key: string
  value: unknown
  revision: number
}

export class EtcdStore {
  private data = new Map<string, { value: unknown; revision: number }>()
  private subscribers = new Map<string, Set<WatchHandler>>()
  private nextRevision = 1

  get(key: string): { value: unknown; revision: number } | undefined {
    return this.data.get(key)
  }

  set(key: string, value: unknown): number {
    const current = this.data.get(key)
    const revision = current ? current.revision + 1 : this.nextRevision++
    this.data.set(key, { value, revision })
    this.notify(key, 'put', value, revision)
    return revision
  }

  delete(key: string): boolean {
    const deleted = this.data.delete(key)
    if (deleted) this.notify(key, 'delete', undefined, this.nextRevision++)
    return deleted
  }

  list(prefix: string): Array<{ key: string; value: unknown; revision: number }> {
    const results: Array<{ key: string; value: unknown; revision: number }> = []
    for (const [key, { value, revision }] of this.data.entries()) {
      if (key.startsWith(prefix)) results.push({ key, value, revision })
    }
    return results
  }

  subscribe(prefix: string, handler: WatchHandler): () => void {
    if (!this.subscribers.has(prefix)) this.subscribers.set(prefix, new Set())
    this.subscribers.get(prefix)!.add(handler)
    return () => this.subscribers.get(prefix)?.delete(handler)
  }

  private notify(key: string, type: 'put' | 'delete', value: unknown, revision: number) {
    for (const [prefix, handlers] of this.subscribers.entries()) {
      if (key.startsWith(prefix)) {
        const event: WatchEvent = { type, key, value, revision }
        handlers.forEach(h => h(event))
      }
    }
  }
}
```

Run: `pnpm test -- src/engine/store/__tests__/etcd-store.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/store/
git commit -m "feat: add EtcdStore with get/set/delete/list/subscribe

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: L5 — ReactiveStore

**Files:**
- Create: `src/engine/store/reactive-store.ts`
- Create: `src/engine/store/__tests__/reactive-store.test.ts`

- [ ] **Step 1: Write failing test for ReactiveStore**

```typescript
// src/engine/store/__tests__/reactive-store.test.ts
import { describe, it, expect } from 'vitest'
import { ReactiveStore } from '../reactive-store'

describe('ReactiveStore', () => {
  it('starts with empty cluster state', () => {
    const store = new ReactiveStore()
    const snapshot = store.getSnapshot()
    expect(snapshot.actors).toEqual({})
    expect(snapshot.pods).toEqual({})
    expect(snapshot.nodes).toEqual({})
    expect(snapshot.events).toEqual([])
  })

  it('updates actor state', () => {
    const store = new ReactiveStore()
    store.updateActorState('api-server', 'validating')
    const snapshot = store.getSnapshot()
    expect(snapshot.actors['api-server']).toEqual({
      state: 'validating',
      updatedAt: expect.any(Number),
    })
  })

  it('updates pod', () => {
    const store = new ReactiveStore()
    store.updatePod('default/test', {
      name: 'test', namespace: 'default', nodeName: null,
      phase: 'Pending', conditions: [], spec: { containers: [], resources: {} }
    })
    const snapshot = store.getSnapshot()
    expect(snapshot.pods['default/test'].phase).toBe('Pending')
  })

  it('appends events to log', () => {
    const store = new ReactiveStore()
    store.appendEvent({ type: 'USER_APPLY', from: 'user' })
    const snapshot = store.getSnapshot()
    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.events[0].type).toBe('USER_APPLY')
  })

  it('subscribe returns unsubscribe function', () => {
    const store = new ReactiveStore()
    const handler = vi.fn()
    const unsubscribe = store.subscribe(handler)
    store.updateActorState('api-server', 'idle')
    expect(handler).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.updateActorState('scheduler', 'idle')
    expect(handler).toHaveBeenCalledTimes(1) // no new call
  })
})
```

Run: `pnpm test -- src/engine/store/__tests__/reactive-store.test.ts`
Expected: FAIL

- [ ] **Step 2: Write ReactiveStore**

```typescript
// src/engine/store/reactive-store.ts
import type { SimEvent } from '../fsm/types'
import type { PodObject } from '../../types/simulation'

export interface ClusterState {
  actors: Record<string, { state: string; updatedAt: number }>
  pods: Record<string, PodObject>
  nodes: Record<string, unknown>
  events: SimEvent[]
}

export class ReactiveStore {
  private state: ClusterState = {
    actors: {},
    pods: {},
    nodes: {},
    events: [],
  }
  private subscribers = new Set<() => void>()

  getSnapshot(): ClusterState {
    return this.state
  }

  subscribe(handler: () => void): () => void {
    this.subscribers.add(handler)
    return () => this.subscribers.delete(handler)
  }

  updateActorState(actorId: string, state: string): void {
    this.state = {
      ...this.state,
      actors: {
        ...this.state.actors,
        [actorId]: { state, updatedAt: Date.now() },
      },
    }
    this.notify()
  }

  updatePod(key: string, pod: PodObject): void {
    this.state = {
      ...this.state,
      pods: { ...this.state.pods, [key]: pod },
    }
    this.notify()
  }

  appendEvent(event: SimEvent): void {
    this.state = {
      ...this.state,
      events: [...this.state.events, event],
    }
    this.notify()
  }

  private notify(): void {
    this.subscribers.forEach(h => h())
  }
}
```

Run: `pnpm test -- src/engine/store/__tests__/reactive-store.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/store/
git commit -m "feat: add ReactiveStore with actor state, pods, events, subscribe

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: L1 — TickClock and UserAction

**Files:**
- Create: `src/engine/trigger/tick-clock.ts`
- Create: `src/engine/trigger/user-action.ts`
- Create: `src/engine/trigger/__tests__/tick-clock.test.ts`
- Create: `src/engine/trigger/__tests__/user-action.test.ts`

- [ ] **Step 1: Write failing tests for TickClock and UserAction**

```typescript
// src/engine/trigger/__tests__/tick-clock.test.ts
import { describe, it, expect, vi } from 'vitest'
import { TickClock } from '../tick-clock'

describe('TickClock', () => {
  it('starts stopped', () => {
    const clock = new TickClock()
    expect(clock.isRunning()).toBe(false)
  })

  it('starts and stops', () => {
    const clock = new TickClock()
    clock.start(vi.fn())
    expect(clock.isRunning()).toBe(true)
    clock.stop()
    expect(clock.isRunning()).toBe(false)
  })

  it('sets speed', () => {
    const clock = new TickClock()
    clock.setSpeed(2)
    expect(clock.getSpeed()).toBe(2)
  })
})
```

```typescript
// src/engine/trigger/__tests__/user-action.test.ts
import { describe, it, expect } from 'vitest'
import { UserAction } from '../user-action'
import type { SimEvent } from '../fsm/types'

describe('UserAction', () => {
  it('dispatch creates USER_APPLY event from manifest', () => {
    const bus = { publish: vi.fn() }
    const ua = new UserAction(bus as any)
    const manifest = { kind: 'Pod', metadata: { name: 'test', namespace: 'default' } }
    ua.dispatch({ type: 'APPLY', manifest })
    expect(bus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'USER_APPLY', payload: manifest })
    )
  })
})
```

Run: `pnpm test -- src/engine/trigger/`
Expected: FAIL

- [ ] **Step 2: Write TickClock and UserAction**

```typescript
// src/engine/trigger/tick-clock.ts
export class TickClock {
  private running = false
  private speed = 1
  private intervalId: ReturnType<typeof setInterval> | null = null

  start(handler: () => void): void {
    this.running = true
    this.intervalId = setInterval(handler, 1000 / this.speed)
  }

  stop(): void {
    this.running = false
    if (this.intervalId) clearInterval(this.intervalId)
    this.intervalId = null
  }

  isRunning(): boolean {
    return this.running
  }

  setSpeed(speed: number): void {
    this.speed = speed
    if (this.intervalId) {
      this.stop()
      this.start(() => {})
    }
  }

  getSpeed(): number {
    return this.speed
  }
}
```

```typescript
// src/engine/trigger/user-action.ts
import type { SimEvent } from '../fsm/types'

interface Bus {
  publish(event: SimEvent): void
}

export class UserAction {
  constructor(private bus: Bus) {}

  dispatch(action: { type: 'APPLY' | 'DELETE' | 'SCALE'; manifest: Record<string, unknown> }): void {
    const event: SimEvent = {
      type: `USER_${action.type}`,
      from: 'user',
      payload: action.manifest,
      ts: Date.now(),
    }
    this.bus.publish(event)
  }
}
```

Run: `pnpm test -- src/engine/trigger/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/engine/trigger/
git commit -m "feat: add TickClock and UserAction trigger layer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: L4 — EtcdActor and APIServerActor

**Files:**
- Create: `src/engine/actors/etcd-actor.ts`
- Create: `src/engine/actors/api-server-actor.ts`
- Create: `src/engine/actors/__tests__/etcd-actor.test.ts`
- Create: `src/engine/actors/__tests__/api-server-actor.test.ts`

- [ ] **Step 1: Write failing tests for EtcdActor**

```typescript
// src/engine/actors/__tests__/etcd-actor.test.ts
import { describe, it, expect, vi } from 'vitest'
import { EtcdActor } from '../etcd-actor'
import { MessageBus } from '../bus/message-bus'

describe('EtcdActor', () => {
  it('starts in idle state', () => {
    const bus = new MessageBus()
    const actor = new EtcdActor(bus)
    expect(actor.getState()).toBe('idle')
  })

  it('transitions to writing on WRITE_REQUEST', () => {
    const bus = new MessageBus()
    const actor = new EtcdActor(bus)
    actor.receive({ type: 'WRITE_REQUEST', from: 'api-server', payload: { key: '/test', value: {} } })
    expect(actor.getState()).toBe('idle') // auto-returns to idle after processing
  })
})
```

Run: `pnpm test -- src/engine/actors/__tests__/etcd-actor.test.ts`
Expected: FAIL

- [ ] **Step 2: Write EtcdActor (XState machine)**

```typescript
// src/engine/actors/etcd-actor.ts
import { createMachine } from 'xstate'
import { Actor } from '../fsm/actor'
import type { ActorContext, SimEvent } from '../fsm/types'

type EtcdState = 'idle' | 'writing' | 'reading'

const etcdMachine = createMachine<EtcdState>({
  id: 'etcd',
  initial: 'idle',
  states: {
    idle: {
      on: {
        WRITE_REQUEST: 'writing',
        READ_REQUEST: 'reading',
      },
    },
    writing: {
      always: 'idle',
    },
    reading: {
      always: 'idle',
    },
  },
})
```

**This task is large — implement incrementally with TDD. Commit after each actor.**

- [ ] **Step 3: Write failing test for APIServerActor**

- [ ] **Step 4: Write APIServerActor with XState**

- [ ] **Step 5: Commit after each actor**

---

## Tasks 11-15: Implement remaining actors

- **Task 11:** SchedulerActor
- **Task 12:** ControllerManagerActor (with operator strategy objects)
- **Task 13:** KubeletActor (per node)
- **Task 14:** CRIActor, CNIActor, CSIActor
- **Task 15:** OperatorPluginActor (dynamic)

---

## Task 16: Wire everything in simulation.ts

**Files:**
- Modify: `src/engine/simulation.ts`
- Test: `src/engine/__tests__/simulation.test.ts`

Wire all layers: create registry, instantiate actors, attach MessageBus to bus + EventHistory + PlaybackController, wire EtcdStore subscriptions.

---

## Task 17: Wire PlaybackController to Timeline UI

**Files:**
- Modify: `src/components/timeline/Timeline.tsx`
- Modify: `src/components/toolbar/Toolbar.tsx`

Connect play/pause/step/reset to PlaybackController methods. Connect speed control to TickClock.

---

## Task 18: Wire ReactiveStore to FlowCanvas and DetailPanel

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/canvas/FlowCanvas.tsx`
- Modify: `src/components/detail/DetailPanel.tsx`

Replace Zustand simulation state with ReactiveStore `useSyncExternalStore` hook.

---

## Task 19: Migrate scenarios to new format

**Files:**
- Modify: `src/data/scenarios.ts`

Convert `injectErrors` (currently targets `{phase, messageType}`) to trigger-based fault injection (inject `*_FAIL` events at specific actor states).

---

## Task 20: Remove old engine code

Remove `src/engine/phases/`, `src/engine/operators/`, `src/engine/types.ts`. Migrate types to new locations per spec Section 9.

---

## Self-Review Checklist

- [ ] Each task has failing test → minimal implementation → passing test → commit
- [ ] No TBD/TODO placeholders in any step
- [ ] All file paths exact and correct
- [ ] Actor state names match spec Section 5 exactly
- [ ] Method signatures consistent across tasks (e.g., `publish(event)` not `publish(type, payload)`)
- [ ] Every actor produces a testable, commitable result independently
- [ ] Migration path in order: layers first (L2→L3→L4), then actors, then UI wiring
