import { ActorRegistry } from '../registry'
import { Actor } from '../actor'
import type { SimEvent, ActorContext } from '../types'
import { FSMachine } from '../xstate-adapter'

// Concrete actor implementation for testing
class TestActor extends Actor<string, string> {
  constructor(id: string) {
    super(id, { getState: () => 'idle', send: () => {}, getInitialState: () => 'idle' } as FSMachine<string>)
  }

  protected makeCtx(): ActorContext {
    return {} as ActorContext
  }

  protected onTransition(state: string, event: SimEvent): void {}
}

describe('ActorRegistry', () => {
  let registry: ActorRegistry
  let actor: Actor<string, string>

  beforeEach(() => {
    registry = new ActorRegistry()
    actor = new TestActor('kubelet:node-1')
  })

  it('register() adds actor to registry', () => {
    registry.register(actor)
    expect(registry.lookup('kubelet:node-1')).toBe(actor)
  })

  it('lookup() returns actor by id', () => {
    registry.register(actor)
    expect(registry.lookup('kubelet:node-1')).toBe(actor)
  })

  it('lookup() returns undefined for nonexistent actor', () => {
    expect(registry.lookup('nonexistent')).toBeUndefined()
  })

  it('getAll() returns all actors', () => {
    const actor2 = new TestActor('scheduler:primary')
    registry.register(actor)
    registry.register(actor2)
    const all = registry.getAll()
    expect(all).toHaveLength(2)
    expect(all).toContain(actor)
    expect(all).toContain(actor2)
  })

  it('getByType() returns actors with matching id prefix', () => {
    const kubelet1 = new TestActor('kubelet:node-1')
    const kubelet2 = new TestActor('kubelet:node-2')
    const scheduler = new TestActor('scheduler:primary')
    registry.register(kubelet1)
    registry.register(kubelet2)
    registry.register(scheduler)

    const kubelets = registry.getByType('kubelet')
    expect(kubelets).toHaveLength(2)
    expect(kubelets).toContain(kubelet1)
    expect(kubelets).toContain(kubelet2)
    expect(kubelets).not.toContain(scheduler)
  })
})