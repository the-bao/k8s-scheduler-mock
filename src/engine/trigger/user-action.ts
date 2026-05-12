import type { MessageBusLike, SimEvent } from '../fsm/types'

export class UserAction {
  private bus: MessageBusLike

  constructor(bus: MessageBusLike) {
    this.bus = bus
  }

  dispatch(action: { type: 'APPLY' | 'DELETE' | 'SCALE'; manifest: Record<string, unknown> }): void {
    const eventTypeMap = {
      APPLY: 'USER_APPLY',
      DELETE: 'USER_DELETE',
      SCALE: 'USER_SCALE',
    } as const

    const event: SimEvent = {
      type: eventTypeMap[action.type],
      from: 'user',
      payload: action.manifest,
    }

    this.bus.publish(event)
  }
}