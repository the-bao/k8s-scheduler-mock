// src/engine/types.ts

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
    reset: () => {
      offset = 0
    },
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
