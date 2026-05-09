// src/engine/phases/kubelet.ts

import type { SimMessage } from '../../types/simulation'
import { makeMessage } from '../types'
import type { PhaseInput } from '../types'

export function generateKubeletPhase(input: PhaseInput): SimMessage[] {
  const { podSpec, podName, namespace, t } = input

  // Pull image for the first container (or a default)
  const containers =
    (podSpec.spec as Record<string, unknown>)?.containers as
      | { name: string; image: string }[]
      | undefined
    ?? [{ name: 'main', image: 'nginx:latest' }]
  const firstContainer = containers[0]

  return [
    makeMessage(
      {
        from: 'etcd',
        to: 'kubelet',
        phase: 'kubelet',
        type: 'WATCH_EVENT_POD_BOUND',
        request: { podName, namespace, node: 'node-1' },
        latency: 3,
      },
      t,
    ),
    makeMessage(
      {
        from: 'kubelet',
        to: 'cri',
        phase: 'kubelet',
        type: 'CREATE_SANDBOX',
        request: { podName, namespace },
        response: { sandboxId: 'sandbox-abc123' },
        latency: 120,
      },
      t,
    ),
    makeMessage(
      {
        from: 'kubelet',
        to: 'cni',
        phase: 'kubelet',
        type: 'CNI_SETUP',
        request: { podName, namespace, sandboxId: 'sandbox-abc123' },
        response: { ip: '10.244.1.5' },
        latency: 45,
      },
      t,
    ),
    makeMessage(
      {
        from: 'kubelet',
        to: 'csi',
        phase: 'kubelet',
        type: 'CSI_STAGE_VOLUME',
        request: { podName, volumeId: 'vol-001' },
        response: { staged: true },
        latency: 80,
      },
      t,
    ),
    makeMessage(
      {
        from: 'kubelet',
        to: 'csi',
        phase: 'kubelet',
        type: 'CSI_PUBLISH_VOLUME',
        request: { podName, volumeId: 'vol-001' },
        response: {
          published: true,
          targetPath: '/var/lib/kubelet/pods/abc/volumes',
        },
        latency: 35,
      },
      t,
    ),
    makeMessage(
      {
        from: 'kubelet',
        to: 'cri',
        phase: 'kubelet',
        type: 'PULL_IMAGE',
        request: { image: firstContainer.image },
        response: { imageId: `sha256:${firstContainer.image}` },
        latency: 2500,
      },
      t,
    ),
    makeMessage(
      {
        from: 'kubelet',
        to: 'cri',
        phase: 'kubelet',
        type: 'START_CONTAINER',
        request: {
          podName,
          containerName: firstContainer.name,
          image: firstContainer.image,
        },
        response: { containerId: 'ctr-xyz789' },
        latency: 200,
      },
      t,
    ),
    makeMessage(
      {
        from: 'kubelet',
        to: 'api-server',
        phase: 'kubelet',
        type: 'UPDATE_POD_STATUS',
        request: {
          podName,
          namespace,
          status: { phase: 'Running', podIP: '10.244.1.5' },
        },
        response: { updated: true },
        latency: 10,
      },
      t,
    ),
    makeMessage(
      {
        from: 'api-server',
        to: 'etcd',
        phase: 'kubelet',
        type: 'WRITE_POD_STATUS',
        request: {
          key: `/registry/pods/${namespace}/${podName}`,
          patch: { status: { phase: 'Running', podIP: '10.244.1.5' } },
        },
        response: { revision: 3 },
        latency: 8,
      },
      t,
    ),
  ]
}
