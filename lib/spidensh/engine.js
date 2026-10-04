import { fetchAnswer } from './adapters.js'
import { QuotaCache } from './cache.js'
import { SPIDENSH_CONFIG } from './config.js'
import { DataCountIndexer } from './indexer.js'
import { TelegramStore } from './telegram-store.js'

/**
 * Spidensh search engine.
 * Pipeline: query -> Data Count signature -> hot cache (memory/LocalStorage)
 *           -> Telegram store -> DuckDuckGo/Wikipedia API -> write-through to both stores.
 * Only clean answers leave this module; numeric signatures and counters stay internal.
 */
export class SpidenshEngine {
  /** @param {Storage} storage */
  constructor(storage) {
    this.storage = storage
    this.indexer = new DataCountIndexer(storage)
    this.cache = new QuotaCache(storage)
    this.telegram = new TelegramStore(storage)
    /** @type {Map<string, Promise<any>>} collapses identical in-flight requests */
    this.inflight = new Map()
    this.controller = null
  }

  /** Synchronous cache peek — shows an answer before the network is touched. */
  peek(query) {
    const q = query.trim()
    if (!q) return null
    const hit = this.cache.get(this.indexer.signature(q))
    return hit ? { answer: hit.answer, source: hit.source, url: hit.url, instant: true, latencyMs: 0 } : null
  }

  /**
   * @param {string} query
   * @returns {Promise<{answer:string, source:string, url?:string, instant:boolean, latencyMs:number}>}
   */
  async search(query) {
    const q = query.trim()
    if (!q) throw new Error('Empty query')
    const started = performance.now()
    const signature = this.indexer.signature(q)
    const done = (r, instant) => ({
      answer: r.answer,
      source: r.source,
      url: r.url,
      instant,
      latencyMs: performance.now() - started,
    })

    const hit = this.cache.get(signature)
    if (hit) return done(hit, true)

    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller

    let pending = this.inflight.get(signature)
    if (!pending) {
      pending = this.resolve(q, signature, controller.signal).finally(() => this.inflight.delete(signature))
      this.inflight.set(signature, pending)
    }
    const { record, fromStore } = await pending
    return done(record, fromStore)
  }

  async resolve(q, signature, signal) {
    if (this.telegram.has(signature)) {
      const stored = await this.telegram.get(signature, signal)
      if (stored?.answer) {
        this.cache.set(signature, stored)
        return { record: stored, fromStore: true }
      }
    }

    const result = await fetchAnswer(q, signal)
    const record = {
      answer: String(result.answer ?? ''),
      source: String(result.source ?? 'Spidensh'),
      url: typeof result.url === 'string' ? result.url : undefined,
      found: result.found !== false,
    }
    if (record.answer && record.found) {
      this.cache.set(signature, record)
      this.telegram.put(signature, { ...record, query: q.slice(0, 200), t: Date.now() })
    }
    return { record, fromStore: false }
  }

  clearCache() {
    this.cache.clear()
    this.telegram.clear()
  }

  /** Aggregate storage usage only; never exposes signatures or token counters. */
  usage() {
    const local = this.cache.stats()
    const remote = this.telegram.usage()
    return {
      bytes: Math.max(local.bytes, remote.bytes),
      maxBytes: SPIDENSH_CONFIG.storageMaxBytes,
      hasData: local.entries > 0 || remote.bytes > 0,
    }
  }
}

let instance = null
export function getEngine() {
  if (typeof window === 'undefined') return null
  if (!instance) instance = new SpidenshEngine(window.localStorage)
  return instance
}

export function readHistory() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(SPIDENSH_CONFIG.storageKeys.history) ?? '[]')
  } catch {
    return []
  }
}

export function writeHistory(query) {
  const next = [query, ...readHistory().filter((q) => q !== query)].slice(0, 8)
  try {
    window.localStorage.setItem(SPIDENSH_CONFIG.storageKeys.history, JSON.stringify(next))
  } catch {}
  return next
}
