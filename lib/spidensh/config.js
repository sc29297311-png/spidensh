/**
 * Spidensh — central configuration.
 * Every external plug-in point is listed here so it can be swapped in one place.
 */
export const SPIDENSH_CONFIG = {
  /** Total storage budget (100 MB) shared by the Telegram store and the local hot cache. */
  storageMaxBytes: 100 * 1024 * 1024,

  /** Local hot cache for instant repeat answers. Browsers cap LocalStorage at ~5-10 MB, so this layer
   *  also evicts on QuotaExceededError; Telegram holds the durable copy. */
  cacheMaxBytes: 100 * 1024 * 1024,

  /** Cached answers older than this are refetched. */
  cacheTtlMs: 1000 * 60 * 60 * 24,

  /** Free, keyless answer sources: DuckDuckGo Instant Answer + Wikipedia (see app/api/answer/route.ts). */
  answerEndpoint: '/api/answer',

  /** Telegram Bot API store for Data Count Indexing records (see app/api/telegram/route.ts).
   *  Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in project Vars. */
  telegramEndpoint: '/api/telegram',

  /** Max size of a single record sent to Telegram. */
  telegramRecordMaxBytes: 64 * 1024,

  recovery: {
    /** Failed recovery attempts allowed before a temporary lockout. */
    maxAttempts: 5,
    lockoutMs: 15 * 60 * 1000,
  },

  storageKeys: {
    index: 'spidensh:dci',
    cacheMeta: 'spidensh:cache:meta',
    cachePrefix: 'spidensh:cache:',
    telegramLedger: 'spidensh:tg:ledger',
    users: 'spidensh:users',
    session: 'spidensh:session',
    history: 'spidensh:history',
    recoveryAttempts: 'spidensh:recovery:attempts',
  },
}
