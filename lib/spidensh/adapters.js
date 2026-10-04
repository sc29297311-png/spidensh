import { SPIDENSH_CONFIG } from './config.js'

/**
 * Answer provider. Uses GET so identical questions are served from the CDN edge cache.
 *
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<{answer:string, source:string, url?:string}>}
 */
export async function fetchAnswer(query, signal) {
  const res = await fetch(`${SPIDENSH_CONFIG.answerEndpoint}?q=${encodeURIComponent(query)}`, { signal })
  if (!res.ok) throw new Error('Answer service unavailable')
  return res.json()
}
