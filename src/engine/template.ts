// src/engine/template.ts

export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function resolveTemplate<T>(template: T, resource: Record<string, unknown>): T {
  if (typeof template === 'string') {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const value = resolvePath(resource, path.trim())
      return value !== undefined ? String(value) : `{{${path.trim()}}}`
    }) as T
  }

  if (Array.isArray(template)) {
    return template.map((item) => resolveTemplate(item, resource)) as T
  }

  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
      result[key] = resolveTemplate(value, resource)
    }
    return result as T
  }

  return template
}
