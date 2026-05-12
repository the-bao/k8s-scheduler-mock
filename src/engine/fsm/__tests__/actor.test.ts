import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Actor } from '../actor'
import type { SimEvent, ActorContext } from '../types'
import type { FSMachine } from '../xstate-adapter'

// Concrete implementation for testing
class TestActor extends Actor<string, string> {
  private ctx: ActorContext
  private transitions: Array<{ state: string; event: SimEvent }> = []

  constructor(id: string, machine: FSMachine<string>) {
    super(id, machine)
    this.ctx = {
      actorId: id,
      bus: {
        publish: vi.fn(),
        route: vi.fn(),
      },
    }
  }

  protected makeCtx(): ActorContext {
    return this.ctx
  }

  protected onTransition(state: string, event: SimEvent): void {
    this.transitions.push({ state, event })
    // Echo event back on bus for testing
    this.ctx.bus.publish({ ...event, from: state })
  }

  getTransitions() {
    return this.transitions
  }
}

function createMockFSM(initial: string): FSMachine<string> {
  return {
    getState: () => initial,
    send: vi.fn(() => null),
  }
}

describe('Actor', () => {
  describe('constructor', () => {
    it('should set actor id', () => {
      const fsm = createMockFSM('idle')
      const actor = new TestActor('test-actor', fsm)
      expect(actor.id).toBe('test-actor')
    })
  })

  describe('receive', () => {
    it('should queue events in mailbox', () => {
      const fsm = createMockFSM('idle')
      const actor = new TestActor('test', fsm)
      const event: SimEvent = { type: 'TEST' }
      actor.receive(event)
      expect(actor.getTransitions()).toHaveLength(1)
    })

    it('should drain mailbox on receive', () => {
      const fsm = createMockFSM('idle')
      const actor = new TestActor('test', fsm)
      actor.receive({ type: 'A' })
      actor.receive({ type: 'B' })
      expect(actor.getTransitions()).toHaveLength(2)
    })

    it('should process events in order', () => {
      const fsm = createMockFSM('idle')
      const actor = new TestActor('test', fsm)
      actor.receive({ type: 'FIRST' })
      actor.receive({ type: 'SECOND' })
      const transitions = actor.getTransitions()
      expect(transitions[0].event.type).toBe('FIRST')
      expect(transitions[1].event.type).toBe('SECOND')
    })
  })

  describe('getState', () => {
    it('should return current FSM state', () => {
      const fsm = createMockFSM('running')
      const actor = new TestActor('test', fsm)
      expect(actor.getState()).toBe('running')
    })
  })

  describe('reset', () => {
    it('should clear mailbox and draining flag', () => {
      const fsm = createMockFSM('idle')
      const actor = new TestActor('test', fsm)
      actor.receive({ type: 'A' })
      actor.reset()
      // reset() clears mailbox and draining flag
      // after reset, receive should drain immediately since draining=false
      actor.receive({ type: 'B' })
      // Only B is processed after reset, A was processed before reset
      expect(actor.getTransitions()).toHaveLength(2) // A + B
      expect(actor.getTransitions()[1].event.type).toBe('B')
    })
  })

  describe('mailbox draining', () => {
    it('should handle multiple events without re-entrancy', () => {
      const fsm = createMockFSM('idle')
      const actor = new TestActor('test', fsm)
      // Events should be processed sequentially, not re-entrantly
      actor.receive({ type: 'A' })
      actor.receive({ type: 'B' })
      expect(actor.getTransitions()).toHaveLength(2)
    })
  })
})