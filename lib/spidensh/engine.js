import { fetchAnswer, pushToTelegram } from './adapters.js'
import { QuotaCache } from './cache.js'
import { SPIDENSH_CONFIG } from './config.js'
import { DataCountIndexer } from './indexer.js'

/**
 * Spidensh search engine.
 * Pipeline: query -> Data Count signature -> memory/LocalStorage cache -> API (deduped, abortable)
 *           -> cache write -> optional Telegram persistence.
 * Only clean answers leave this module; numeric signatures stay internal.
 */
export class SpidenshEngine {
  /** @param {Storage} storage */
  constructor(storage) {
    this.storage = storage
    this.indexer = new DataCountIndexer(storage)
    this.cache = new QuotaCache(storage)
    /** @type {Map<string, Promise<any>>} collapses identical in-flight requests */
    this.inflight = new Map()
    this.controller = null
  }

  /** Synchronous cache peek — lets the UI show an answer before the network is touched. */
  peek(query) {
    const q = query.trim()
    if (!q) return null
    const hit = this.cache.get(this.indexer.signature(q))
    return hit ? { ...hit, cached: true, latencyMs: 0 } : null
  }

  /**
   * @param {string} query
   * @param {{user?: string}} [opts]
   * @returns {Promise<{answer:string, source:string, url?:string, cached:boolean, latencyMs:number}>}
   */
  async search(query, opts = {}) {
    const q = query.trim()
    if (!q) throw new Error('Empty query')
    const started = performance.now()
    const signature = this.indexer.signature(q)

    const hit = this.cache.get(signature)
    if (hit) return { ...hit, cached: true, latencyMs: performance.now() - started }

    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller

    let pending = this.inflight.get(signature)
    if (!pending) {
      pending = fetchAnswer(q, controller.signal).finally(() => this.inflight.delete(signature))
      this.inflight.set(signature, pending)
    }

    const result = await pending
    const clean = {
      answer: String(result.answer ?? ''),
      source: String(result.source ?? 'Spidensh'),
      url: result.url,
    }
    if (clean.answer) {
      this.cache.set(signature, clean)
      pushToTelegram({ type: 'search', user: opts.user, query: q, answer: clean.answer.slice(0, 500) })
    }
    return { ...clean, cached: false, latencyMs: performance.now() - started }
  }

  clearCache() {
    this.cache.clear()
  }

  /** Public stats intentionally expose only aggregate sizes, never the token-to-number map. */
  stats() {
    return this.cache.stats()
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
