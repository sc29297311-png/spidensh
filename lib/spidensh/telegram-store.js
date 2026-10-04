import { SPIDENSH_CONFIG } from './config.js'

/**
 * Telegram-backed durable store for Data Count Indexing records.
 * Each record is uploaded to your Telegram chat as a small JSON document. Telegram returns a file_id,
 * which is kept in a tiny local ledger (signature -> file_id). On a local cache miss the record is
 * downloaded back from Telegram through the server route, so the bot token never reaches the browser.
 *
 * The ledger enforces the 100 MB budget with LRU eviction; evicted records are deleted from the chat.
 */
export class TelegramStore {
  /** @param {Storage} storage */
  constructor(storage, maxBytes = SPIDENSH_CONFIG.storageMaxBytes) {
    this.storage = storage
    this.maxBytes = maxBytes
    this.key = SPIDENSH_CONFIG.storageKeys.telegramLedger
    this.endpoint = SPIDENSH_CONFIG.telegramEndpoint
    /** @type {Map<string, {fileId:string, messageId:number, size:number, t:number}>} LRU order */
    this.refs = new Map()
    this.bytes = 0
    /** null = unknown, checked lazily on first write */
    this.enabled = null
    this.load()
  }

  load() {
    try {
      const entries = JSON.parse(this.storage.getItem(this.key) ?? '[]')
      for (const [sig, ref] of entries) {
        this.refs.set(sig, ref)
        this.bytes += ref.size
      }
    } catch {
      this.refs.clear()
      this.bytes = 0
    }
  }

  save() {
    try {
      this.storage.setItem(this.key, JSON.stringify([...this.refs.entries()]))
    } catch {}
  }

  async isEnabled() {
    if (this.enabled !== null) return this.enabled
    try {
      const res = await fetch(this.endpoint, { method: 'GET' })
      this.enabled = res.ok && (await res.json()).configured === true
    } catch {
      this.enabled = false
    }
    return this.enabled
  }

  has(signature) {
    return this.refs.has(signature)
  }

  /** @returns {Promise<any|null>} */
  async get(signature, signal) {
    const ref = this.refs.get(signature)
    if (!ref) return null
    try {
      const res = await fetch(`${this.endpoint}?fileId=${encodeURIComponent(ref.fileId)}`, { signal })
      if (!res.ok) throw new Error('missing')
      const { record } = await res.json()
      this.refs.delete(signature)
      this.refs.set(signature, { ...ref, t: Date.now() })
      this.save()
      return record ?? null
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      this.drop(signature, false)
      return null
    }
  }

  /** Fire-and-forget write. Never blocks the search path. */
  async put(signature, record) {
    if (!(await this.isEnabled())) return
    const body = JSON.stringify({ signature, record })
    const size = body.length * 2
    if (size > SPIDENSH_CONFIG.telegramRecordMaxBytes) return
    if (this.refs.has(signature)) this.drop(signature, true)
    while (this.bytes + size > this.maxBytes && this.refs.size) {
      this.drop(this.refs.keys().next().value, true)
    }
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      })
      if (!res.ok) return
      const { fileId, messageId } = await res.json()
      if (!fileId) return
      this.refs.set(signature, { fileId, messageId, size, t: Date.now() })
      this.bytes += size
      this.save()
    } catch {}
  }

  drop(signature, remote) {
    const ref = this.refs.get(signature)
    if (!ref) return
    this.refs.delete(signature)
    this.bytes -= ref.size
    this.save()
    if (remote && ref.messageId) {
      fetch(`${this.endpoint}?messageId=${ref.messageId}`, { method: 'DELETE', keepalive: true }).catch(() => {})
    }
  }

  clear() {
    for (const sig of [...this.refs.keys()]) this.drop(sig, true)
  }

  usage() {
    return { bytes: this.bytes, maxBytes: this.maxBytes }
  }
}
