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
