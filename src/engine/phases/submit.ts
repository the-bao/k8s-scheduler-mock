// src/engine/phases/submit.ts

import type { SimMessage } from '../../types/simulation'
import { makeMessage } from '../types'
import type { PhaseInput } from '../types'

export function generateSubmitPhase(input: PhaseInput): SimMessage[] {
  const { podSpec, podName, namespace, t } = input

  return [
    makeMessage(
      {
        from: 'user',
        to: 'api-server',
        phase: 'submit',
        type: 'CREATE_POD',
        request: { pod: podSpec },
        latency: 5,
      },
      t,
    ),
    makeMessage(
      {
        from: 'api-server',
        to: 'etcd',
        phase: 'submit',
        type: 'WRITE_POD',
        request: { key: `/registry/pods/${namespace}/${podName}`, value: podSpec },
        latency: 12,
      },
      t,
    ),
    makeMessage(
      {
        from: 'etcd',
        to: 'api-server',
        phase: 'submit',
        type: 'WRITE_POD_RESPONSE',
        request: {},
        response: { revision: 1 },
        latency: 8,
      },
      t,
    ),
    makeMessage(
      {
        from: 'api-server',
        to: 'user',
        phase: 'submit',
        type: 'CREATE_POD_RESPONSE',
        request: {},
        response: { uid: `${namespace}/${podName}`, created: true },
        latency: 3,
      },
      t,
    ),
  ]
}
