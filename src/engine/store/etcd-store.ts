export interface EtcdEntry {
  value: unknown
  revision: number
}

export interface WatchEvent {
  type: 'write' | 'delete'
  key: string
  value?: unknown
  revision: number
}

type WatchHandler = (event: WatchEvent) => void

export class EtcdStore {
  private data: Map<string, EtcdEntry> = new Map()
  private revision = 0
  private subscribers: Map<string, Set<WatchHandler>> = new Map()

  get(key: string): { value: unknown; revision: number } | undefined {
    const entry = this.data.get(key)
    if (!entry) return undefined
    return { value: entry.value, revision: entry.revision }
  }

  set(key: string, value: unknown): number {
    this.revision++
    this.data.set(key, { value, revision: this.revision })
    this.notifySubscribers(key, 'write', value)
    return this.revision
  }

  delete(key: string): boolean {
    if (!this.data.has(key)) return false
    this.revision++
    this.data.delete(key)
    this.notifySubscribers(key, 'delete')
    return true
  }

  list(prefix: string): Array<{ key: string; value: unknown; revision: number }> {
    const results: Array<{ key: string; value: unknown; revision: number }> = []
    for (const [key, entry] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        results.push({ key, value: entry.value, revision: entry.revision })
      }
    }
    return results
  }

  subscribe(prefix: string, handler: WatchHandler): () => void {
    if (!this.subscribers.has(prefix)) {
      this.subscribers.set(prefix, new Set())
    }
    this.subscribers.get(prefix)!.add(handler)
    return () => {
      this.subscribers.get(prefix)?.delete(handler)
    }
  }

  private notifySubscribers(key: string, type: 'write' | 'delete', value?: unknown): void {
    for (const [prefix, handlers] of this.subscribers.entries()) {
      if (key.startsWith(prefix)) {
        const revision = this.revision
        for (const handler of handlers) {
          handler({ type, key, value, revision })
        }
      }
    }
  }
}