import type { SimMessage, CustomResource } from '../../types/simulation'
import type { ControllerRegistry } from '../operators/registry'
import type { OperatorPhaseInput } from '../types'

export function generateOperatorPhase(
  input: OperatorPhaseInput,
  registry: ControllerRegistry,
): SimMessage[] {
  const { podSpec, nodeNames } = input
  const allMessages: SimMessage[] = []
  const resourceKind = String(podSpec.kind ?? '')
  // Convert kind to watch resource name: "Deployment" -> "deployments"
  const lowerKind = resourceKind.toLowerCase() + 's'

  const watchers = registry.findWatching(lowerKind)
  if (watchers.length === 0) {
    return allMessages // No matching controller — skip operator phase
  }

  // BFS queue for chain reconcile: resource -> controller -> new resource -> next controller
  const pendingEvents: Array<{
    eventType: 'Added' | 'Modified' | 'Deleted'
    resource: Record<string, unknown>
    depth: number
  }> = [{ eventType: 'Added', resource: podSpec, depth: 0 }]

  const createdResources: CustomResource[] = []

  while (pendingEvents.length > 0) {
    const event = pendingEvents.shift()!
    if (event.depth > 3) break // Cap chain depth

    const eventKind = (String((event.resource as Record<string, unknown>).kind ?? '')).toLowerCase() + 's'
    const controllers = registry.findWatching(eventKind)

    for (const ctrl of controllers) {
      const results = ctrl.reconcile(
        { eventType: event.eventType, resource: event.resource, existingResources: createdResources },
        nodeNames,
      )

      for (const result of results) {
        allMessages.push(...result.messages)
        if (result.resourceChanges.created) {
          createdResources.push(result.resourceChanges.created)
          // Chain: newly created resource triggers next level of reconcile
          pendingEvents.push({
            eventType: 'Added',
            resource: result.resourceChanges.created as unknown as Record<string, unknown>,
            depth: event.depth + 1,
          })
        }
      }
    }
  }

  return allMessages
}
