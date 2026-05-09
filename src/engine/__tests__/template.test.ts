import { resolveTemplate, resolvePath } from '../template'

describe('resolvePath', () => {
  it('extracts nested value from object', () => {
    expect(resolvePath({ spec: { replicas: 3 } }, 'spec.replicas')).toBe(3)
  })

  it('returns undefined for missing path', () => {
    expect(resolvePath({ spec: {} }, 'spec.replicas')).toBeUndefined()
  })

  it('handles single-level path', () => {
    expect(resolvePath({ name: 'test' }, 'name')).toBe('test')
  })
})

describe('resolveTemplate', () => {
  const resource = {
    metadata: { name: 'my-app', namespace: 'default' },
    spec: { replicas: 3, selector: { matchLabels: { app: 'my-app' } } },
  }

  it('replaces {{variable}} in string', () => {
    const result = resolveTemplate('{{metadata.name}}-abc123', resource)
    expect(result).toBe('my-app-abc123')
  })

  it('replaces multiple variables', () => {
    const result = resolveTemplate('{{metadata.namespace}}/{{metadata.name}}', resource)
    expect(result).toBe('default/my-app')
  })

  it('resolves numeric values', () => {
    const result = resolveTemplate('{{spec.replicas}}', resource)
    expect(result).toBe('3')
  })

  it('resolves nested object values', () => {
    const result = resolveTemplate({ name: '{{metadata.name}}', replicas: '{{spec.replicas}}' }, resource)
    expect(result).toEqual({ name: 'my-app', replicas: '3' })
  })

  it('resolves variables in arrays', () => {
    const result = resolveTemplate(['{{metadata.name}}', '{{metadata.namespace}}'], resource)
    expect(result).toEqual(['my-app', 'default'])
  })

  it('returns non-string primitives as-is', () => {
    expect(resolveTemplate(42, resource)).toBe(42)
    expect(resolveTemplate(true, resource)).toBe(true)
    expect(resolveTemplate(null, resource)).toBe(null)
  })

  it('leaves unmatched variables as-is', () => {
    const result = resolveTemplate('{{unknown.path}}', resource)
    expect(result).toBe('{{unknown.path}}')
  })
})
