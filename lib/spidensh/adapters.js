import { SPIDENSH_CONFIG } from './config.js'

/**
 * PLUG POINT — Answer provider.
 * Calls the server route, which talks to Hugging Face / Mistral (or free knowledge APIs as fallback).
 * Keeping the call server-side means API tokens never reach the browser.
 *
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<{answer:string, source:string, url?:string}>}
 */
export async function fetchAnswer(query, signal) {
  const res = await fetch(SPIDENSH_CONFIG.answerEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })
  if (!res.ok) throw new Error('Answer service unavailable')
  return res.json()
}

/**
 * PLUG POINT — Telegram Bot API storage.
 * Fire-and-forget: forwards a record to app/api/telegram/route.ts, which posts it to your bot's chat.
 * Never blocks the search path.
 *
 * @param {{type:string, user?:string, query?:string, answer?:string}} record
 */
export function pushToTelegram(record) {
  if (!SPIDENSH_CONFIG.telegramEndpoint) return
  const body = JSON.stringify(record)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(SPIDENSH_CONFIG.telegramEndpoint, new Blob([body], { type: 'application/json' }))
    return
  }
  fetch(SPIDENSH_CONFIG.telegramEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}
