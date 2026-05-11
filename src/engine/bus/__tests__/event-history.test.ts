import { EventHistory } from '../event-history'
import type { SimEvent } from '../../fsm/types'

describe('EventHistory', () => {
  let history: EventHistory

  beforeEach(() => {
    history = new EventHistory()
  })

  it('records events and returns all via getAll()', () => {
    const event1: SimEvent = { type: 'TEST_EVENT_1', from: 'node1', to: 'node2' }
    const event2: SimEvent = { type: 'TEST_EVENT_2', payload: { data: 'test' } }

    history.record(event1)
    history.record(event2)

    const all = history.getAll()
    expect(all).toHaveLength(2)
    expect(all[0]).toEqual(event1)
    expect(all[1]).toEqual(event2)
  })

  it('getUpTo(index) returns events up to and including index', () => {
    const events: SimEvent[] = [
      { type: 'A' },
      { type: 'B' },
      { type: 'C' },
      { type: 'D' }
    ]

    events.forEach(e => history.record(e))

    expect(history.getUpTo(0)).toHaveLength(1)
    expect(history.getUpTo(0)[0].type).toBe('A')

    expect(history.getUpTo(2)).toHaveLength(3)
    expect(history.getUpTo(2)[2].type).toBe('C')

    expect(history.getUpTo(3)).toHaveLength(4)
  })

  it('clear() empties all events', () => {
    history.record({ type: 'X' })
    history.record({ type: 'Y' })
    expect(history.getAll()).toHaveLength(2)

    history.clear()

    expect(history.getAll()).toHaveLength(0)
  })

  it('events can be re-recorded after clear', () => {
    history.record({ type: 'FIRST' })
    history.clear()

    history.record({ type: 'SECOND' })
    const all = history.getAll()

    expect(all).toHaveLength(1)
    expect(all[0].type).toBe('SECOND')
  })
})