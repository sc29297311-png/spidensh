import { SPIDENSH_CONFIG } from './config.js'

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'to', 'for', 'and', 'or',
  'what', 'who', 'whom', 'which', 'how', 'why', 'when', 'where', 'do', 'does', 'did', 'me',
  'tell', 'about', 'please', 'can', 'you', 'i', 'it', 'be', 'by', 'with', 'as', 'at',
])

/**
 * Data Count Indexing (DCI).
 * Every unique token that enters the engine is mapped to a monotonically increasing integer.
 * A query is then represented as a sorted set of integers, which becomes its cache signature:
 * "capital of France" and "France capital" both resolve to the same numeric signature.
 * These numbers are internal only and are never rendered in the UI.
 */
export class DataCountIndexer {
  /** @param {Storage} storage */
  constructor(storage) {
    this.storage = storage
    this.key = SPIDENSH_CONFIG.storageKeys.index
    this.counter = 0
    /** @type {Map<string, number>} */
    this.tokenToId = new Map()
    this.load()
  }

  load() {
    try {
      const raw = this.storage.getItem(this.key)
      if (!raw) return
      const parsed = JSON.parse(raw)
      this.counter = parsed.counter ?? 0
      this.tokenToId = new Map(Object.entries(parsed.map ?? {}))
    } catch {
      this.counter = 0
      this.tokenToId = new Map()
    }
  }

  persist() {
    try {
      this.storage.setItem(
        this.key,
        JSON.stringify({ counter: this.counter, map: Object.fromEntries(this.tokenToId) }),
      )
    } catch {
      // Index is reconstructible; losing it only costs cache hits.
    }
  }

  /** @param {string} text */
  tokenize(text) {
    return text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t && !STOP_WORDS.has(t))
  }

  /** @param {string} token */
  idFor(token) {
    let id = this.tokenToId.get(token)
    if (id === undefined) {
      id = ++this.counter
      this.tokenToId.set(token, id)
      this.dirty = true
    }
    return id
  }

  /** @param {string} text @returns {number[]} */
  encode(text) {
    const ids = [...new Set(this.tokenize(text).map((t) => this.idFor(t)))].sort((a, b) => a - b)
    if (this.dirty) {
      this.persist()
      this.dirty = false
    }
    return ids
  }

  /** Numeric signature used as the cache key. Falls back to a hash for stop-word-only queries. */
  signature(text) {
    const ids = this.encode(text)
    if (ids.length) return ids.join('.')
    let h = 0
    for (const ch of text.trim().toLowerCase()) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0
    return `h${h >>> 0}`
  }

  get size() {
    return this.tokenToId.size
  }
}
