// src/store/simulation-store.ts

import { create } from 'zustand'
import type {
  SimulationStatus,
  SimMessage,
  SimNode,
  ResourceStore,
  PluginConfig,
  Scenario,
  OperatorConfig,
  CustomResource,
} from '../types/simulation'
import {
  generateMessages,
  getDefaultNodes,
  getDefaultResources,
} from '../engine/simulation'
import { DeploymentController } from '../engine/operators/deployment'
import { ReplicaSetController } from '../engine/operators/replicaset'
import { DaemonSetController } from '../engine/operators/daemonset'
import { JobController } from '../engine/operators/job'
import { CronJobController } from '../engine/operators/cronjob'

interface SimulationState {
  status: SimulationStatus
  messages: SimMessage[]
  currentIndex: number
  speed: number
  resources: ResourceStore
  nodes: SimNode[]
  plugins: PluginConfig[]
  operators: OperatorConfig[]
  customResources: Record<string, Record<string, CustomResource>>
  breakpoints: string[]

  startSimulation: (
    podSpec: Record<string, unknown>,
    scenario?: Scenario,
  ) => void
  play: () => void
  pause: () => void
  stepForward: () => void
  stepBackward: () => void
  setSpeed: (speed: number) => void
  jumpTo: (index: number) => void
  addPlugin: (plugin: PluginConfig) => void
  removePlugin: (name: string) => void
  addOperator: (operator: OperatorConfig) => void
  removeOperator: (name: string) => void
  loadBuiltinOperators: () => void
  toggleBreakpoint: (messageId: string) => void
  reset: () => void
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  status: 'idle',
  messages: [],
  currentIndex: -1,
  speed: 1,
  resources: getDefaultResources(),
  nodes: getDefaultNodes(),
  plugins: [],
  operators: [],
  customResources: {},
  breakpoints: [],

  startSimulation(podSpec, scenario) {
    const plugins = get().plugins
    const operators = get().operators
    const messages = generateMessages(podSpec, plugins, scenario, operators)

    // Build node list: builtins + plugin nodes + operator nodes
    const pluginNodes: SimNode[] = plugins.map((p) => ({
      id: p.metadata.name,
      type: 'plugin' as const,
      component: p.metadata.name,
      label: p.metadata.name,
      state: 'idle' as const,
    }))

    const operatorNodes: SimNode[] = operators.map((o) => ({
      id: o.metadata.name,
      type: 'plugin' as const,
      component: o.metadata.name,
      label: o.metadata.name,
      state: 'idle' as const,
    }))

    set({
      status: 'running',
      messages,
      currentIndex: -1,
      nodes: [...getDefaultNodes(), ...pluginNodes, ...operatorNodes],
      resources: getDefaultResources(),
    })
  },

  play() {
    set({ status: 'running' })
  },

  pause() {
    set({ status: 'paused' })
  },

  stepForward() {
    const { currentIndex, messages } = get()
    const next = currentIndex + 1
    if (next >= messages.length) {
      set({ status: 'completed', currentIndex: messages.length - 1 })
    } else {
      set({ currentIndex: next })
    }
  },

  stepBackward() {
    const { currentIndex } = get()
    if (currentIndex >= 0) {
      set({ currentIndex: currentIndex - 1 })
    }
  },

  setSpeed(speed) {
    set({ speed })
  },

  jumpTo(index) {
    const { messages } = get()
    const clamped = Math.max(-1, Math.min(index, messages.length - 1))
    set({
      currentIndex: clamped,
      status: clamped >= messages.length - 1 ? 'completed' : get().status,
    })
  },

  addPlugin(plugin) {
    set((state) => ({ plugins: [...state.plugins, plugin] }))
  },

  removePlugin(name) {
    set((state) => ({
      plugins: state.plugins.filter((p) => p.metadata.name !== name),
    }))
  },

  addOperator(operator) {
    set((state) => ({ operators: [...state.operators, operator] }))
  },

  removeOperator(name) {
    set((state) => ({
      operators: state.operators.filter((o) => o.metadata.name !== name),
    }))
  },

  loadBuiltinOperators() {
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

  toggleBreakpoint(messageId) {
    set((state) => {
      const has = state.breakpoints.includes(messageId)
      return {
        breakpoints: has
          ? state.breakpoints.filter((id) => id !== messageId)
          : [...state.breakpoints, messageId],
      }
    })
  },

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
}))
