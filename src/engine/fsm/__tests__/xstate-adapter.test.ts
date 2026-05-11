import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createXStateMachine, type FSMachine } from '../xstate-adapter'

describe('createXStateMachine', () => {
  it('should create a machine with initial state', () => {
    const machine = createXStateMachine({
      initial: 'idle',
      states: {
        idle: {},
        running: {},
      },
    })
    expect(machine.getState()).toBe('idle')
  })

  it('should return FSMachine interface', () => {
    const machine = createXStateMachine({
      initial: 'idle',
      states: {
        idle: {},
      },
    })
    expect(typeof machine.getState).toBe('function')
    expect(typeof machine.send).toBe('function')
  })

  it('should handle send event and transition to next state', () => {
    const machine = createXStateMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { START: 'running' },
        },
        running: {},
      },
    })
    expect(machine.getState()).toBe('idle')
    const nextState = machine.send({ type: 'START' })
    expect(nextState).toBe('running')
    expect(machine.getState()).toBe('running')
  })

  it('should support multiple state types', () => {
    type States = 'pending' | 'active' | 'completed'
    const machine = createXStateMachine<States>({
      initial: 'pending',
      states: {
        pending: {},
        active: {},
        completed: {},
      },
    })
    expect(machine.getState()).toBe('pending')
  })
})

describe('FSMachine interface', () => {
  it('should be implemented correctly', () => {
    const machine: FSMachine<string> = createXStateMachine({
      initial: 'test',
      states: { test: {} },
    })
    expect(typeof machine.getState).toBe('function')
    expect(typeof machine.send).toBe('function')
  })
})