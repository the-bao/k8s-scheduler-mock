import type { Controller } from '../../types/simulation'

export class ControllerRegistry {
  private controllers = new Map<string, Controller>()

  register(controller: Controller): void {
    this.controllers.set(controller.name, controller)
  }

  unregister(name: string): void {
    this.controllers.delete(name)
  }

  get(name: string): Controller | undefined {
    return this.controllers.get(name)
  }

  getAll(): Controller[] {
    return [...this.controllers.values()]
  }

  findWatching(resourceKind: string): Controller[] {
    const lower = resourceKind.toLowerCase()
    return [...this.controllers.values()].filter((c) =>
      c.config.spec.watchResources.some((r) => r.toLowerCase() === lower),
    )
  }
}
