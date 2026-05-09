// src/engine/phases/controller.ts

import type {
  SimMessage,
  PluginConfig,
  PluginAction,
} from '../../types/simulation'
import { makeMessage } from '../types'
import type { PhaseInput } from '../types'

export interface ControllerPhaseInput extends PhaseInput {
  plugins: PluginConfig[]
}

export function generateControllerPhase(input: ControllerPhaseInput): SimMessage[] {
  const { podSpec, podName, namespace, t, plugins } = input

  const messages: SimMessage[] = []

  messages.push(
    makeMessage(
      {
        from: 'etcd',
        to: 'controller-manager',
        phase: 'controller',
        type: 'WATCH_EVENT_POD_ADDED',
        request: { pod: podSpec },
        latency: 2,
      },
      t,
    ),
  )

  // Emit operator plugin messages
  const operatorPlugins = plugins.filter((p) => p.kind === 'OperatorPlugin')
  for (const plugin of operatorPlugins) {
    const rules = plugin.spec.reconcile ?? []
    for (const rule of rules) {
      for (const action of rule.actions) {
        messages.push(
          buildOperatorPluginMessage(plugin, action, podName, namespace, t),
        )
      }
    }
    // Also emit for top-level actions if no reconcile rules
    if (rules.length === 0 && plugin.spec.actions) {
      for (const action of plugin.spec.actions) {
        messages.push(
          buildOperatorPluginMessage(plugin, action, podName, namespace, t),
        )
      }
    }
  }

  return messages
}

// ── Helper: build an operator plugin message ──────────────────────────
function buildOperatorPluginMessage(
  plugin: PluginConfig,
  action: PluginAction,
  podName: string,
  namespace: string,
  t: () => number,
): SimMessage {
  return makeMessage(
    {
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
    },
    t,
  )
}
