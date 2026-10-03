import { SPIDENSH_CONFIG } from './config.js'

const byteSize = (str) => str.length * 2 // LocalStorage stores UTF-16

/**
 * LRU cache persisted to LocalStorage with a byte budget (default 100 MB).
 * An in-memory mirror makes hits synchronous (sub-millisecond); LocalStorage is the durable layer.
 */
export class QuotaCache {
  /** @param {Storage} storage */
  constructor(storage, maxBytes = SPIDENSH_CONFIG.cacheMaxBytes) {
    this.storage = storage
    this.maxBytes = maxBytes
    this.prefix = SPIDENSH_CONFIG.storageKeys.cachePrefix
    this.metaKey = SPIDENSH_CONFIG.storageKeys.cacheMeta
    /** @type {Map<string, {size:number, t:number}>} insertion order == LRU order */
    this.meta = new Map()
    /** @type {Map<string, any>} */
    this.hot = new Map()
    this.totalBytes = 0
    this.loadMeta()
  }

  loadMeta() {
    try {
      const raw = this.storage.getItem(this.metaKey)
      const entries = raw ? JSON.parse(raw) : []
      entries.sort((a, b) => a[1].t - b[1].t)
      for (const [k, v] of entries) {
        this.meta.set(k, v)
        this.totalBytes += v.size
      }
    } catch {
      this.meta.clear()
    }
  }

  saveMeta() {
    try {
      this.storage.setItem(this.metaKey, JSON.stringify([...this.meta.entries()]))
    } catch {
      this.evictOldest()
    }
  }

  get(key) {
    const m = this.meta.get(key)
    if (!m) return null
    if (Date.now() - m.t > SPIDENSH_CONFIG.cacheTtlMs) {
      this.delete(key)
      return null
    }
    let value = this.hot.get(key)
    if (value === undefined) {
      const raw = this.storage.getItem(this.prefix + key)
      if (!raw) {
        this.delete(key)
        return null
      }
      value = JSON.parse(raw)
      this.hot.set(key, value)
    }
    this.meta.delete(key)
    this.meta.set(key, { ...m, t: m.t })
    return value
  }

  set(key, value) {
    const serialized = JSON.stringify(value)
    const size = byteSize(serialized) + byteSize(key)
    if (size > this.maxBytes) return false
    if (this.meta.has(key)) this.delete(key)

    while (this.totalBytes + size > this.maxBytes && this.meta.size) this.evictOldest()

    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        this.storage.setItem(this.prefix + key, serialized)
        this.meta.set(key, { size, t: Date.now() })
        this.hot.set(key, value)
        this.totalBytes += size
        this.saveMeta()
        return true
      } catch {
        if (!this.meta.size) return false
        this.evictOldest()
      }
    }
    return false
  }

  delete(key) {
    const m = this.meta.get(key)
    if (!m) return
    this.storage.removeItem(this.prefix + key)
    this.meta.delete(key)
    this.hot.delete(key)
    this.totalBytes -= m.size
    this.saveMeta()
  }

  evictOldest() {
    const oldest = this.meta.keys().next().value
    if (oldest !== undefined) this.delete(oldest)
  }

  clear() {
    for (const key of [...this.meta.keys()]) this.storage.removeItem(this.prefix + key)
    this.meta.clear()
    this.hot.clear()
    this.totalBytes = 0
    this.saveMeta()
  }

  stats() {
    return { entries: this.meta.size, bytes: this.totalBytes, maxBytes: this.maxBytes }
  }
}
