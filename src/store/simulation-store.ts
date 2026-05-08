// src/store/simulation-store.ts

import { create } from 'zustand'
import type {
  SimulationStatus,
  SimMessage,
  SimNode,
  ResourceStore,
  PluginConfig,
  Scenario,
} from '../types/simulation'
import {
  generateMessages,
  getDefaultNodes,
  getDefaultResources,
} from '../engine/simulation'

interface SimulationState {
  status: SimulationStatus
  messages: SimMessage[]
  currentIndex: number
  speed: number
  resources: ResourceStore
  nodes: SimNode[]
  plugins: PluginConfig[]
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
  breakpoints: [],

  startSimulation(podSpec, scenario) {
    const plugins = get().plugins
    const messages = generateMessages(podSpec, plugins, scenario)

    // Build node list: builtins + plugin nodes
    const pluginNodes: SimNode[] = plugins.map((p) => ({
      id: p.metadata.name,
      type: 'plugin',
      component: p.metadata.name,
      label: p.metadata.name,
      state: 'idle',
    }))

    set({
      status: 'running',
      messages,
      currentIndex: -1,
      nodes: [...getDefaultNodes(), ...pluginNodes],
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
    })
  },
}))
