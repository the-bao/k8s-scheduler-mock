# K8s Pod Creation Visualizer - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a frontend visualization tool that simulates the complete K8s Pod creation lifecycle with plugin support for custom Operator/CNI/CSI debugging.

**Architecture:** Event-driven simulation engine generates messages between K8s component nodes. React Flow renders the architecture graph with animated data flow. Zustand manages global state. YAML-based plugin system lets users inject custom component behavior.

**Tech Stack:** React 18, TypeScript, Vite, React Flow, Zustand, js-yaml

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`

**Step 1: Create Vite React TypeScript project**

```bash
cd G:/study_with_ai/k8s-scheduler-mock
npm create vite@latest . -- --template react-ts
```

If prompted about existing files, choose to overwrite.

**Step 2: Install dependencies**

```bash
npm install @xyflow/react zustand js-yaml @types/js-yaml
npm install -D @types/node tailwindcss @tailwindcss/vite
```

**Step 3: Configure Tailwind**

Modify `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Replace `src/index.css` with:

```css
@import "tailwindcss";
```

**Step 4: Verify setup**

```bash
npm run dev
```

Open http://localhost:5173, confirm Vite + React page loads.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold React + TypeScript + Vite project with dependencies"
```

---

### Task 2: TypeScript Type Definitions

**Files:**
- Create: `src/types/simulation.ts`

**Step 1: Define all core types**

```typescript
// src/types/simulation.ts

export type Phase = 'submit' | 'controller' | 'scheduling' | 'kubelet' | 'completed'

export type ComponentType =
  | 'api-server'
  | 'etcd'
  | 'controller-manager'
  | 'scheduler'
  | 'kubelet'
  | 'cri'
  | 'cni'
  | 'csi'
  | string // custom plugin

export interface SimError {
  code: number
  message: string
  retryable: boolean
}

export interface SimMessage {
  id: string
  from: string
  to: string
  phase: Phase
  type: string
  request: Record<string, unknown>
  response?: Record<string, unknown>
  error?: SimError
  latency: number
  timestamp: number
}

export type SimNodeState = 'idle' | 'processing' | 'error'

export interface SimNode {
  id: string
  type: 'builtin' | 'plugin'
  component: ComponentType
  label: string
  state: SimNodeState
}

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

export interface ResourceStore {
  pods: Record<string, PodResource>
  nodes: Record<string, NodeResource>
  pvcs: Record<string, PVCResource>
  configmaps: Record<string, Record<string, unknown>>
}

export interface PodResource {
  name: string
  namespace: string
  status: string
  nodeName: string
  labels: Record<string, string>
  containers: ContainerSpec[]
  conditions: PodCondition[]
  ip?: string
}

export interface ContainerSpec {
  name: string
  image: string
  resources: { cpu: string; memory: string }
}

export interface PodCondition {
  type: string
  status: string
  reason?: string
}

export interface NodeResource {
  name: string
  cpu: { capacity: number; allocatable: number; used: number }
  memory: { capacity: number; allocatable: number; used: number }
  labels: Record<string, string>
}

export interface PVCResource {
  name: string
  namespace: string
  storageClassName: string
  accessModes: string[]
  capacity: string
  phase: string
}

export interface Simulation {
  status: SimulationStatus
  messages: SimMessage[]
  currentIndex: number
  speed: number
  resources: ResourceStore
  nodes: SimNode[]
  plugins: PluginConfig[]
  breakpoints: string[]
}

// Plugin types

export type PluginKind = 'OperatorPlugin' | 'CNIPlugin' | 'CSIPlugin'

export interface PluginMatch {
  resource: string
  labelSelector?: Record<string, string>
}

export interface PluginAction {
  type: string
  resource?: Record<string, unknown>
  patch?: Record<string, unknown>
  error?: { code: number; message: string }
}

export interface PluginReconcileRule {
  match: PluginMatch
  actions: PluginAction[]
}

export interface PluginUI {
  icon: string
  color: string
  position: 'left' | 'right' | 'top' | 'bottom'
}

export interface PluginConfig {
  apiVersion: string
  kind: PluginKind
  metadata: {
    name: string
    watchResources?: string[]
  }
  spec: {
    reconcile?: PluginReconcileRule[]
    actions?: PluginAction[]
  }
  ui: PluginUI
}

// Scenario types

export interface Scenario {
  id: string
  name: string
  description: string
  podYaml: Record<string, unknown>
  injectErrors?: { phase: Phase; messageType: string; error: SimError }[]
}

// React Flow node data

export interface K8sNodeData {
  simNode: SimNode
  isActive: boolean
}
```

**Step 2: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions for simulation engine"
```

---

### Task 3: Simulation Engine - Core State Machine

**Files:**
- Create: `src/engine/simulation.ts`
- Create: `src/store/simulation-store.ts`

**Step 1: Create the simulation engine**

```typescript
// src/engine/simulation.ts

import type {
  SimMessage, SimNode, Phase, ResourceStore,
  PodResource, NodeResource, PluginConfig, Scenario
} from '../types/simulation'

let msgCounter = 0

function msgId(): string {
  return `msg-${++msgCounter}`
}

const builtinNodes: SimNode[] = [
  { id: 'api-server', type: 'builtin', component: 'api-server', label: 'API Server', state: 'idle' },
  { id: 'etcd', type: 'builtin', component: 'etcd', label: 'etcd', state: 'idle' },
  { id: 'controller-manager', type: 'builtin', component: 'controller-manager', label: 'Controller Manager', state: 'idle' },
  { id: 'scheduler', type: 'builtin', component: 'scheduler', label: 'Scheduler', state: 'idle' },
  { id: 'kubelet', type: 'builtin', component: 'kubelet', label: 'Kubelet', state: 'idle' },
  { id: 'cri', type: 'builtin', component: 'cri', label: 'CRI (Containerd)', state: 'idle' },
  { id: 'cni', type: 'builtin', component: 'cni', label: 'CNI Plugin', state: 'idle' },
  { id: 'csi', type: 'builtin', component: 'csi', label: 'CSI Plugin', state: 'idle' },
]

const defaultNodes: NodeResource[] = [
  {
    name: 'node-1',
    cpu: { capacity: 8, allocatable: 7.5, used: 2 },
    memory: { capacity: 32768, allocatable: 30720, used: 8192 },
    labels: { 'topology.kubernetes.io/zone': 'zone-a' },
  },
  {
    name: 'node-2',
    cpu: { capacity: 4, allocatable: 3.5, used: 1 },
    memory: { capacity: 16384, allocatable: 14336, used: 4096 },
    labels: { 'topology.kubernetes.io/zone': 'zone-b' },
  },
]

function makeMsg(
  from: string, to: string, phase: Phase, type: string,
  request: Record<string, unknown>,
  response?: Record<string, unknown>,
  latency = 10,
): SimMessage {
  return {
    id: msgId(),
    from, to, phase, type, request, response,
    latency,
    timestamp: Date.now(),
  }
}

export function generateMessages(
  podSpec: Record<string, unknown>,
  plugins: PluginConfig[],
  scenario?: Scenario,
): SimMessage[] {
  const messages: SimMessage[] = []
  const podName = (podSpec.metadata as Record<string, string>)?.name ?? 'my-pod'
  const namespace = (podSpec.metadata as Record<string, string>)?.namespace ?? 'default'

  // Phase 1: Submit & Persist
  messages.push(makeMsg('user', 'api-server', 'submit', 'CREATE_POD', {
    method: 'POST',
    path: `/api/v1/namespaces/${namespace}/pods`,
    body: podSpec,
  }))

  messages.push(makeMsg('api-server', 'etcd', 'submit', 'WRITE_POD', {
    key: `/registry/pods/${namespace}/${podName}`,
    value: { ...podSpec, status: { phase: 'Pending' } },
  }, { succeeded: true }, 5))

  messages.push(makeMsg('etcd', 'api-server', 'submit', 'WRITE_POD_RESPONSE', {}, {
    succeeded: true,
    revision: 1,
  }, 2))

  messages.push(makeMsg('api-server', 'user', 'submit', 'CREATE_POD_RESPONSE', {}, {
    code: 201,
    message: 'Created',
  }))

  // Phase 2: Controller
  messages.push(makeMsg('etcd', 'controller-manager', 'controller', 'WATCH_EVENT_POD_ADDED', {
    eventType: 'ADDED',
    object: { ...podSpec, status: { phase: 'Pending' } },
  }))

  // Plugin operator reconcile
  const operatorPlugins = plugins.filter(p => p.kind === 'OperatorPlugin')
  for (const plugin of operatorPlugins) {
    if (plugin.spec.reconcile) {
      for (const rule of plugin.spec.reconcile) {
        for (const action of rule.actions) {
          messages.push(makeMsg('controller-manager', plugin.metadata.name, 'controller',
            `OPERATOR_${action.type.toUpperCase()}`,
            { action, podName, namespace },
            { status: 'reconciled' },
            15,
          ))
        }
      }
    }
  }

  // Phase 3: Scheduling
  messages.push(makeMsg('etcd', 'scheduler', 'scheduling', 'WATCH_EVENT_UNSCHEDULED_POD', {
    eventType: 'ADDED',
    object: { ...podSpec, spec: { ...podSpec.spec, nodeName: undefined } },
  }))

  messages.push(makeMsg('scheduler', 'scheduler', 'scheduling', 'FILTER_NODES', {
    nodes: defaultNodes.map(n => n.name),
    pod: podSpec,
  }, {
    feasible: ['node-1', 'node-2'],
    filtered: [],
  }, 20))

  messages.push(makeMsg('scheduler', 'scheduler', 'scheduling', 'SCORE_NODES', {
    nodes: ['node-1', 'node-2'],
    pod: podSpec,
  }, {
    scores: { 'node-1': 65, 'node-2': 42 },
    selected: 'node-1',
  }, 15))

  const selectedNode = 'node-1'

  messages.push(makeMsg('scheduler', 'api-server', 'scheduling', 'BIND_POD', {
    pod: podName,
    namespace,
    node: selectedNode,
  }))

  messages.push(makeMsg('api-server', 'etcd', 'scheduling', 'UPDATE_POD_BIND', {
    key: `/registry/pods/${namespace}/${podName}`,
    value: { ...podSpec, spec: { ...podSpec.spec, nodeName: selectedNode } },
  }, { succeeded: true }, 5))

  // Phase 4: Kubelet
  messages.push(makeMsg('etcd', 'kubelet', 'kubelet', 'WATCH_EVENT_POD_BOUND', {
    eventType: 'MODIFIED',
    object: { ...podSpec, spec: { ...podSpec.spec, nodeName: selectedNode } },
  }))

  messages.push(makeMsg('kubelet', 'cri', 'kubelet', 'CREATE_SANDBOX', {
    podName,
    namespace,
    runtime: 'containerd',
  }, {
    sandboxId: 'sandbox-abc123',
    status: 'ready',
  }, 50))

  // CNI
  messages.push(makeMsg('kubelet', 'cni', 'kubelet', 'CNI_SETUP', {
    podName,
    namespace,
    netns: '/var/run/netns/abc123',
  }, {
    ip: '10.244.1.5',
    gateway: '10.244.1.1',
    interface: 'eth0',
  }, 30))

  // CSI
  messages.push(makeMsg('kubelet', 'csi', 'kubelet', 'CSI_STAGE_VOLUME', {
    volumeId: 'vol-123',
    stagingPath: '/var/lib/kubelet/pods/abc123/volumes/staging',
  }, {
    status: 'staged',
  }, 40))

  messages.push(makeMsg('kubelet', 'csi', 'kubelet', 'CSI_PUBLISH_VOLUME', {
    volumeId: 'vol-123',
    targetPath: '/var/lib/kubelet/pods/abc123/volumes/publish',
  }, {
    status: 'published',
  }, 20))

  // Image pull + start
  const containerSpec = (podSpec.spec as Record<string, unknown>)?.containers as Array<Record<string, unknown>> | undefined
  const imageName = containerSpec?.[0]?.image ?? 'nginx:latest'

  messages.push(makeMsg('kubelet', 'cri', 'kubelet', 'PULL_IMAGE', {
    image: imageName,
  }, {
    status: 'pulled',
    size: '187MB',
  }, 200))

  messages.push(makeMsg('kubelet', 'cri', 'kubelet', 'START_CONTAINER', {
    podName,
    containerName: containerSpec?.[0]?.name ?? 'main',
    image: imageName,
  }, {
    containerId: 'ctr-xyz789',
    status: 'running',
  }, 100))

  // Final status update
  messages.push(makeMsg('kubelet', 'api-server', 'kubelet', 'UPDATE_POD_STATUS', {
    pod: podName,
    namespace,
    status: { phase: 'Running', podIP: '10.244.1.5' },
  }))

  messages.push(makeMsg('api-server', 'etcd', 'kubelet', 'WRITE_POD_STATUS', {
    key: `/registry/pods/${namespace}/${podName}`,
    value: { status: { phase: 'Running', podIP: '10.244.1.5' } },
  }, { succeeded: true }, 5))

  messages.push(makeMsg('api-server', 'kubelet', 'completed', 'STATUS_UPDATE_ACK', {}, {
    code: 200,
  }))

  // Apply scenario error injections
  if (scenario?.injectErrors) {
    for (const inject of scenario.injectErrors) {
      const target = messages.find(
        m => m.phase === inject.phase && m.type === inject.messageType
      )
      if (target) {
        target.error = inject.error
        target.response = { error: inject.error }
      }
    }
  }

  return messages
}

export function getDefaultNodes(): SimNode[] {
  return builtinNodes.map(n => ({ ...n }))
}

export function getDefaultResources(): ResourceStore {
  const nodes: Record<string, NodeResource> = {}
  for (const n of defaultNodes) {
    nodes[n.name] = { ...n }
  }
  return {
    pods: {},
    nodes,
    pvcs: {},
    configmaps: {},
  }
}
```

**Step 2: Create Zustand store**

```typescript
// src/store/simulation-store.ts

import { create } from 'zustand'
import type {
  Simulation, SimMessage, PluginConfig, Scenario,
} from '../types/simulation'
import {
  generateMessages, getDefaultNodes, getDefaultResources,
} from '../engine/simulation'

interface SimulationStore extends Simulation {
  // Actions
  startSimulation: (podSpec: Record<string, unknown>, scenario?: Scenario) => void
  play: () => void
  pause: () => void
  stepForward: () => void
  stepBackward: () => void
  setSpeed: (speed: number) => void
  jumpTo: (index: number) => void
  addPlugin: (plugin: PluginConfig) => void
  removePlugin: (name: string) => void
  toggleBreakpoint: (messageId: string) => void
  reset: () => void
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  status: 'idle',
  messages: [],
  currentIndex: -1,
  speed: 1,
  resources: getDefaultResources(),
  nodes: getDefaultNodes(),
  plugins: [],
  breakpoints: [],

  startSimulation: (podSpec, scenario) => {
    const { plugins } = get()
    const messages = generateMessages(podSpec, plugins, scenario)
    const nodes = getDefaultNodes()

    // Add plugin nodes
    for (const plugin of plugins) {
      nodes.push({
        id: plugin.metadata.name,
        type: 'plugin',
        component: plugin.metadata.name,
        label: plugin.metadata.name,
        state: 'idle',
      })
    }

    set({
      status: 'running',
      messages,
      currentIndex: -1,
      nodes,
      resources: getDefaultResources(),
    })
  },

  play: () => set({ status: 'running' }),
  pause: () => set({ status: 'paused' }),

  stepForward: () => {
    const { currentIndex, messages, status } = get()
    if (currentIndex < messages.length - 1) {
      const nextIndex = currentIndex + 1
      set({ currentIndex: nextIndex })
    } else {
      set({ status: 'completed' })
    }
  },

  stepBackward: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 })
    }
  },

  setSpeed: (speed) => set({ speed }),

  jumpTo: (index) => set({ currentIndex: Math.max(-1, Math.min(index, get().messages.length - 1)) }),

  addPlugin: (plugin) => {
    set({ plugins: [...get().plugins, plugin] })
  },

  removePlugin: (name) => {
    set({ plugins: get().plugins.filter(p => p.metadata.name !== name) })
  },

  toggleBreakpoint: (messageId) => {
    const { breakpoints } = get()
    if (breakpoints.includes(messageId)) {
      set({ breakpoints: breakpoints.filter(id => id !== messageId) })
    } else {
      set({ breakpoints: [...breakpoints, messageId] })
    }
  },

  reset: () => {
    set({
      status: 'idle',
      messages: [],
      currentIndex: -1,
      nodes: getDefaultNodes(),
      resources: getDefaultResources(),
    })
  },
}))
```

**Step 3: Commit**

```bash
git add src/engine/ src/store/
git commit -m "feat: add simulation engine core and Zustand store"
```

---

### Task 4: React Flow Canvas - Architecture Graph

**Files:**
- Create: `src/components/canvas/K8sNode.tsx`
- Create: `src/components/canvas/FlowCanvas.tsx`
- Create: `src/components/canvas/node-layout.ts`

**Step 1: Define node layout positions**

```typescript
// src/components/canvas/node-layout.ts

import type { Node } from '@xyflow/react'
import type { K8sNodeData } from '../../types/simulation'

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
]
```

**Step 2: Create custom K8s node component**

```tsx
// src/components/canvas/K8sNode.tsx

import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { K8sNodeData } from '../../types/simulation'

const componentColors: Record<string, string> = {
  'api-server': '#326CE5',
  'etcd': '#4CAF50',
  'controller-manager': '#FF9800',
  'scheduler': '#9C27B0',
  'kubelet': '#00BCD4',
  'cri': '#607D8B',
  'cni': '#FF5722',
  'csi': '#795548',
}

export function K8sNode({ data }: NodeProps & { data: K8sNodeData }) {
  const { simNode, isActive } = data
  const color = simNode.type === 'plugin'
    ? '#E91E63'
    : componentColors[simNode.component] || '#666'

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 text-white text-sm font-medium min-w-[120px] text-center transition-all duration-300 ${
        isActive ? 'scale-110 shadow-lg shadow-white/20' : ''
      } ${simNode.state === 'error' ? 'animate-pulse' : ''}`}
      style={{
        borderColor: isActive ? '#fff' : color,
        backgroundColor: color,
        borderStyle: simNode.type === 'plugin' ? 'dashed' : 'solid',
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <div className="font-bold">{simNode.label}</div>
      <div className="text-xs opacity-70">{simNode.state}</div>
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
    </div>
  )
}
```

**Step 3: Create FlowCanvas component**

```tsx
// src/components/canvas/FlowCanvas.tsx

import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange,
  applyNodeChanges, applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useMemo } from 'react'
import { useSimulationStore } from '../../store/simulation-store'
import { K8sNode } from './K8sNode'
import { builtinPositions, builtinEdges } from './node-layout'

const nodeTypes = { k8s: K8sNode }

export function FlowCanvas() {
  const { nodes: simNodes, messages, currentIndex } = useSimulationStore()

  const activeFrom = currentIndex >= 0 ? messages[currentIndex]?.from : null
  const activeTo = currentIndex >= 0 ? messages[currentIndex]?.to : null

  const flowNodes: Node[] = useMemo(() => {
    return simNodes.map((sn) => {
      const pos = builtinPositions[sn.id] ?? { x: 600, y: 400 }
      return {
        id: sn.id,
        type: 'k8s',
        position: pos,
        data: {
          simNode: sn,
          isActive: sn.id === activeFrom || sn.id === activeTo,
        },
      }
    })
  }, [simNodes, activeFrom, activeTo])

  const flowEdges: Edge[] = useMemo(() => {
    return builtinEdges.map((e) => {
      const isActive =
        currentIndex >= 0 &&
        messages[currentIndex] &&
        ((messages[currentIndex].from === e.source && messages[currentIndex].to === e.target) ||
         (messages[currentIndex].from === e.target && messages[currentIndex].to === e.source))

      return {
        ...e,
        animated: isActive,
        style: {
          stroke: isActive ? '#3b82f6' : '#555',
          strokeWidth: isActive ? 3 : 1,
        },
        labelStyle: { fill: '#aaa', fontSize: 10 },
      }
    })
  }, [currentIndex, messages])

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    // no-op, layout is fixed
  }, [])

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    // no-op
  }, [])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#333" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-600 [&>button]:!bg-gray-800 [&>button]:!border-gray-600 [&>button]:!text-white [&>button:hover]:!bg-gray-700" />
        <MiniMap
          nodeColor={() => '#326CE5'}
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-gray-800 !border-gray-600"
        />
      </ReactFlow>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/components/canvas/
git commit -m "feat: add React Flow canvas with K8s architecture graph"
```

---

### Task 5: Detail Panel

**Files:**
- Create: `src/components/detail/DetailPanel.tsx`

**Step 1: Create detail panel with tabs**

```tsx
// src/components/detail/DetailPanel.tsx

import { useState } from 'react'
import { useSimulationStore } from '../../store/simulation-store'

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="text-xs text-green-400 bg-gray-900 p-3 rounded overflow-auto max-h-[300px] whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export function DetailPanel() {
  const [tab, setTab] = useState<'request' | 'logs' | 'status'>('request')
  const { messages, currentIndex, resources } = useSimulationStore()

  const currentMsg = currentIndex >= 0 ? messages[currentIndex] : null

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      <div className="flex border-b border-gray-700">
        {(['request', 'logs', 'status'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === 'request' && (
          currentMsg ? (
            <div className="space-y-3">
              <div className="text-xs text-gray-400">
                <span className="text-yellow-400">{currentMsg.type}</span>
                {' '}({currentMsg.phase})
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">From → To</div>
                <div className="text-sm text-white">
                  {currentMsg.from} → {currentMsg.to}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Request</div>
                <JsonBlock data={currentMsg.request} />
              </div>
              {currentMsg.response && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Response</div>
                  <JsonBlock data={currentMsg.response} />
                </div>
              )}
              {currentMsg.error && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 text-red-400">Error</div>
                  <JsonBlock data={currentMsg.error} />
                </div>
              )}
              <div className="text-xs text-gray-500">
                Latency: {currentMsg.latency}ms
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No message selected</div>
          )
        )}

        {tab === 'logs' && (
          <div className="space-y-1 font-mono text-xs">
            {messages.slice(0, currentIndex + 1).map((msg, i) => (
              <div key={msg.id} className={`py-0.5 ${i === currentIndex ? 'bg-gray-800 -mx-1 px-1 rounded' : ''}`}>
                <span className="text-gray-500">{new Date(msg.timestamp).toISOString().slice(11, 23)}</span>{' '}
                <span className="text-cyan-400">[{msg.from}]</span>{' '}
                <span className={msg.error ? 'text-red-400' : 'text-gray-300'}>{msg.type}</span>
                {msg.error && <span className="text-red-400"> ERROR: {msg.error.message}</span>}
              </div>
            ))}
            {currentIndex < 0 && <div className="text-gray-500">No logs yet</div>}
          </div>
        )}

        {tab === 'status' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-2">Pods</div>
              {Object.keys(resources.pods).length === 0 ? (
                <div className="text-gray-600 text-xs">No pods</div>
              ) : (
                Object.entries(resources.pods).map(([name, pod]) => (
                  <div key={name} className="text-xs mb-1">
                    <span className="text-white">{name}</span>{' '}
                    <span className={pod.status === 'Running' ? 'text-green-400' : 'text-yellow-400'}>
                      {pod.status}
                    </span>
                    {pod.nodeName && <span className="text-gray-500"> on {pod.nodeName}</span>}
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Nodes</div>
              {Object.entries(resources.nodes).map(([name, node]) => (
                <div key={name} className="text-xs mb-2">
                  <div className="text-white">{name}</div>
                  <div className="text-gray-400 ml-2">
                    CPU: {node.cpu.used}/{node.cpu.allocatable} | MEM: {node.memory.used}/{node.memory.allocatable}MB
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/detail/
git commit -m "feat: add detail panel with request/log/status tabs"
```

---

### Task 6: Timeline

**Files:**
- Create: `src/components/timeline/Timeline.tsx`

**Step 1: Create timeline component**

```tsx
// src/components/timeline/Timeline.tsx

import { useSimulationStore } from '../../store/simulation-store'
import type { Phase } from '../../types/simulation'

const phaseColors: Record<Phase, string> = {
  submit: '#3b82f6',
  controller: '#f59e0b',
  scheduling: '#8b5cf6',
  kubelet: '#06b6d4',
  completed: '#22c55e',
}

export function Timeline() {
  const {
    messages, currentIndex, speed,
    play, pause, stepForward, stepBackward,
    setSpeed, jumpTo, status,
  } = useSimulationStore()

  const isRunning = status === 'running'

  return (
    <div className="bg-gray-900 border-t border-gray-700 p-2">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={isRunning ? pause : play}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
        >
          {isRunning ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={stepBackward}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
        >
          ← Step
        </button>
        <button
          onClick={stepForward}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
        >
          Step →
        </button>

        <div className="flex items-center gap-1 ml-4">
          <span className="text-xs text-gray-400">Speed:</span>
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs ${
                speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-gray-400">
          {currentIndex + 1} / {messages.length}
        </span>
      </div>

      {/* Timeline dots */}
      <div className="flex items-center gap-0.5 overflow-x-auto py-1">
        {messages.map((msg, i) => (
          <button
            key={msg.id}
            onClick={() => jumpTo(i)}
            className={`w-3 h-3 rounded-full shrink-0 transition-all hover:scale-150 ${
              i === currentIndex ? 'ring-2 ring-white scale-125' : ''
            } ${i <= currentIndex ? 'opacity-100' : 'opacity-40'}`}
            style={{ backgroundColor: phaseColors[msg.phase] }}
            title={`${msg.type} (${msg.phase})`}
          />
        ))}
      </div>

      {/* Phase labels */}
      <div className="flex text-xs text-gray-500 mt-1">
        {(['submit', 'controller', 'scheduling', 'kubelet', 'completed'] as Phase[]).map((phase) => (
          <span key={phase} className="flex items-center gap-1 mr-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: phaseColors[phase] }} />
            {phase}
          </span>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/timeline/
git commit -m "feat: add timeline component with playback controls"
```

---

### Task 7: Toolbar & Pod Templates

**Files:**
- Create: `src/components/toolbar/Toolbar.tsx`
- Create: `src/data/scenarios.ts`

**Step 1: Create preset scenarios**

```typescript
// src/data/scenarios.ts

import type { Scenario } from '../types/simulation'

const basePod = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: {
    name: 'my-app',
    namespace: 'default',
    labels: { app: 'my-app' },
  },
  spec: {
    containers: [
      {
        name: 'main',
        image: 'nginx:latest',
        resources: {
          cpu: '500m',
          memory: '256Mi',
        },
      },
    ],
  },
}

export const scenarios: Scenario[] = [
  {
    id: 'normal',
    name: 'Normal Creation',
    description: 'Pod creates successfully through the full lifecycle',
    podYaml: basePod,
  },
  {
    id: 'insufficient-resources',
    name: 'Insufficient Resources',
    description: 'All nodes lack resources, Pod stays Pending',
    podYaml: {
      ...basePod,
      metadata: { ...basePod.metadata, name: 'big-app' },
      spec: {
        containers: [{
          name: 'main',
          image: 'nginx:latest',
          resources: { cpu: '16', memory: '65536Mi' },
        }],
      },
    },
  },
  {
    id: 'cni-failure',
    name: 'CNI Network Failure',
    description: 'CNI plugin fails to configure network',
    podYaml: basePod,
    injectErrors: [
      {
        phase: 'kubelet',
        messageType: 'CNI_SETUP',
        error: { code: 500, message: 'CNI failed to setup network: no IP available', retryable: true },
      },
    ],
  },
  {
    id: 'csi-timeout',
    name: 'CSI Mount Timeout',
    description: 'CSI driver times out during volume mount',
    podYaml: basePod,
    injectErrors: [
      {
        phase: 'kubelet',
        messageType: 'CSI_STAGE_VOLUME',
        error: { code: 504, message: 'CSI stage volume timeout after 60s', retryable: true },
      },
    ],
  },
  {
    id: 'image-pull-failure',
    name: 'Image Pull Failure',
    description: 'Container image cannot be pulled',
    podYaml: {
      ...basePod,
      spec: {
        containers: [{
          name: 'main',
          image: 'nonexistent:image',
          resources: { cpu: '500m', memory: '256Mi' },
        }],
      },
    },
    injectErrors: [
      {
        phase: 'kubelet',
        messageType: 'PULL_IMAGE',
        error: { code: 404, message: 'ImagePullBackOff: image not found', retryable: true },
      },
    ],
  },
]
```

**Step 2: Create toolbar component**

```tsx
// src/components/toolbar/Toolbar.tsx

import { useState } from 'react'
import { useSimulationStore } from '../../store/simulation-store'
import { scenarios } from '../../data/scenarios'

export function Toolbar() {
  const { startSimulation, status, reset } = useSimulationStore()
  const [selectedScenario, setSelectedScenario] = useState('normal')

  const handleStart = () => {
    const scenario = scenarios.find(s => s.id === selectedScenario)
    if (scenario) {
      startSimulation(scenario.podYaml, scenario)
    }
  }

  return (
    <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center gap-4">
      <h1 className="text-white font-bold text-sm">K8s Pod Lifecycle Visualizer</h1>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Scenario:</span>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleStart}
        disabled={status === 'running'}
        className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded text-xs font-medium"
      >
        Create Pod
      </button>

      <button
        onClick={reset}
        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
      >
        Reset
      </button>

      <span className={`ml-auto text-xs ${
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

**Step 3: Commit**

```bash
git add src/components/toolbar/ src/data/
git commit -m "feat: add toolbar with scenario selector and preset fault scenarios"
```

---

### Task 8: Plugin Editor

**Files:**
- Create: `src/components/toolbar/PluginEditor.tsx`

**Step 1: Create plugin editor modal**

```tsx
// src/components/toolbar/PluginEditor.tsx

import { useState } from 'react'
import yaml from 'js-yaml'
import { useSimulationStore } from '../../store/simulation-store'
import type { PluginConfig } from '../../types/simulation'

const defaultOperatorYaml = `apiVersion: sim.k8s.io/v1
kind: OperatorPlugin
metadata:
  name: my-operator
  watchResources:
    - pods
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
            name: my-app-config
            data:
              key: value
ui:
  icon: cog
  color: "#e74c3c"
  position: right
`

const defaultCniYaml = `apiVersion: sim.k8s.io/v1
kind: CNIPlugin
metadata:
  name: my-cni
spec:
  actions:
    - type: setupNetwork
    - type: assignIP
ui:
  icon: network
  color: "#ff5722"
  position: right
`

const defaultCsiYaml = `apiVersion: sim.k8s.io/v1
kind: CSIPlugin
metadata:
  name: my-csi
spec:
  actions:
    - type: provisionVolume
    - type: mountVolume
ui:
  icon: storage
  color: "#795548"
  position: right
`

export function PluginEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { plugins, addPlugin, removePlugin } = useSimulationStore()
  const [yamlText, setYamlText] = useState(defaultOperatorYaml)
  const [error, setError] = useState('')

  if (!open) return null

  const handleAdd = () => {
    try {
      const parsed = yaml.load(yamlText) as PluginConfig
      if (!parsed.apiVersion || !parsed.kind || !parsed.metadata?.name) {
        setError('Missing required fields: apiVersion, kind, metadata.name')
        return
      }
      addPlugin(parsed)
      setError('')
    } catch (e) {
      setError(`YAML parse error: ${(e as Error).message}`)
    }
  }

  const templates = [
    { label: 'Operator', yaml: defaultOperatorYaml },
    { label: 'CNI Plugin', yaml: defaultCniYaml },
    { label: 'CSI Plugin', yaml: defaultCsiYaml },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-bold text-sm">Plugin Manager</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">X</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Loaded plugins */}
          {plugins.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-2">Loaded Plugins</div>
              {plugins.map((p) => (
                <div key={p.metadata.name} className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded mb-1">
                  <div>
                    <span className="text-white text-xs font-medium">{p.metadata.name}</span>
                    <span className="text-gray-400 text-xs ml-2">{p.kind}</span>
                  </div>
                  <button
                    onClick={() => removePlugin(p.metadata.name)}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Template buttons */}
          <div className="flex gap-2">
            {templates.map((t) => (
              <button
                key={t.label}
                onClick={() => { setYamlText(t.yaml); setError('') }}
                className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600"
              >
                {t.label} Template
              </button>
            ))}
          </div>

          {/* YAML editor */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Plugin YAML</div>
            <textarea
              value={yamlText}
              onChange={(e) => { setYamlText(e.target.value); setError('') }}
              className="w-full h-[250px] bg-gray-900 text-green-400 text-xs p-3 rounded border border-gray-600 font-mono resize-none"
              spellCheck={false}
            />
          </div>

          {error && <div className="text-red-400 text-xs">{error}</div>}

          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium"
          >
            Add Plugin
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/toolbar/PluginEditor.tsx
git commit -m "feat: add plugin editor with YAML editor and templates"
```

---

### Task 9: App Shell & Auto-Play Logic

**Files:**
- Modify: `src/App.tsx`
- Create: `src/hooks/useAutoPlay.ts`

**Step 1: Create auto-play hook**

```typescript
// src/hooks/useAutoPlay.ts

import { useEffect, useRef } from 'react'
import { useSimulationStore } from '../store/simulation-store'

export function useAutoPlay() {
  const { status, speed, stepForward, messages, currentIndex } = useSimulationStore()
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (status === 'running') {
      const delay = 800 / speed
      intervalRef.current = window.setInterval(() => {
        stepForward()
      }, delay)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [status, speed, stepForward])
}
```

**Step 2: Wire up App.tsx**

```tsx
// src/App.tsx

import { useState } from 'react'
import { FlowCanvas } from './components/canvas/FlowCanvas'
import { DetailPanel } from './components/detail/DetailPanel'
import { Timeline } from './components/timeline/Timeline'
import { Toolbar } from './components/toolbar/Toolbar'
import { PluginEditor } from './components/toolbar/PluginEditor'
import { useAutoPlay } from './hooks/useAutoPlay'

export default function App() {
  const [pluginEditorOpen, setPluginEditorOpen] = useState(false)
  useAutoPlay()

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-700">
        <h1 className="font-bold text-sm">K8s Pod Lifecycle Visualizer</h1>
        <Toolbar />
        <button
          onClick={() => setPluginEditorOpen(true)}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs"
        >
          Plugins
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-[3]">
          <FlowCanvas />
        </div>
        <div className="flex-1 min-w-[280px]">
          <DetailPanel />
        </div>
      </div>

      <Timeline />
      <PluginEditor open={pluginEditorOpen} onClose={() => setPluginEditorOpen(false)} />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/App.tsx src/hooks/
git commit -m "feat: wire up App shell with auto-play and layout"
```

---

### Task 10: Polish & Verify

**Step 1: Clean up unused Vite template files**

Remove any leftover `src/assets/`, `public/vite.svg` etc. from the scaffold.

**Step 2: Run dev server and verify**

```bash
npm run dev
```

Verify:
- Architecture graph renders with all K8s components
- Select a scenario and click "Create Pod"
- Messages animate through the graph
- Timeline dots appear and playback works
- Detail panel shows request/response/logs
- Plugin editor opens, YAML validates, plugins load

**Step 3: Build check**

```bash
npm run build
```

Ensure no TypeScript errors.

**Step 4: Commit**

```bash
git add .
git commit -m "chore: clean up and verify full integration"
```
