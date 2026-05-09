import type { Controller } from '../../types/simulation'
import { ControllerRegistry } from './registry'
import { DeploymentController } from './deployment'
import { ReplicaSetController } from './replicaset'
import { DaemonSetController } from './daemonset'
import { JobController } from './job'
import { CronJobController } from './cronjob'

const builtinControllers: Controller[] = [
  new DeploymentController(),
  new ReplicaSetController(),
  new DaemonSetController(),
  new JobController(),
  new CronJobController(),
]

export function createRegistryWithBuiltins(): ControllerRegistry {
  const registry = new ControllerRegistry()
  for (const ctrl of builtinControllers) {
    registry.register(ctrl)
  }
  return registry
}

export { ControllerRegistry } from './registry'
export { DeploymentController } from './deployment'
export { ReplicaSetController } from './replicaset'
export { DaemonSetController } from './daemonset'
export { JobController } from './job'
export { CronJobController } from './cronjob'
