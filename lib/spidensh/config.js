/**
 * Spidensh — central configuration.
 * Every external plug-in point is listed here so it can be swapped in one place.
 */
export const SPIDENSH_CONFIG = {
  /** Hard ceiling for the browser cache (100 MB). Browsers usually cap LocalStorage at ~5-10 MB,
   *  so the cache also evicts on QuotaExceededError before reaching this ceiling. */
  cacheMaxBytes: 100 * 1024 * 1024,

  /** Cached answers older than this are refetched. */
  cacheTtlMs: 1000 * 60 * 60 * 24,

  /** PLUG POINT — AI / answer API. Server route that calls Hugging Face / Mistral (see app/api/answer/route.ts). */
  answerEndpoint: '/api/answer',

  /** PLUG POINT — Telegram Bot API storage. Server route that forwards records to a Telegram chat
   *  (see app/api/telegram/route.ts). Set to null to disable remote persistence. */
  telegramEndpoint: '/api/telegram',

  storageKeys: {
    index: 'spidensh:dci',
    cacheMeta: 'spidensh:cache:meta',
    cachePrefix: 'spidensh:cache:',
    users: 'spidensh:users',
    session: 'spidensh:session',
    history: 'spidensh:history',
  },
}
