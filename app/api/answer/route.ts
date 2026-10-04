import { NextResponse } from 'next/server'

type Answer = { answer: string; source: string; url?: string }

const UA = 'Spidensh/1.0 (https://vercel.app; answer engine)'
const TIMEOUT_MS = 4500

/** DuckDuckGo Instant Answer API — free, keyless. Best for direct facts, calculations, definitions. */
async function askDuckDuckGo(query: string, signal: AbortSignal): Promise<Answer> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&skip_disambig=1&t=spidensh`
  const res = await fetch(url, { signal, headers: { 'User-Agent': UA }, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error('ddg')
  const data = await res.json()
  const text: string = data.Answer || data.AbstractText || data.Definition || ''
  if (typeof text !== 'string' || !text.trim()) throw new Error('ddg-empty')
  return {
    answer: text.trim(),
    source: data.AbstractSource || 'DuckDuckGo',
    url: data.AbstractURL || data.DefinitionURL || undefined,
  }
}

/** Wikipedia — single round-trip: search + plain-text intro extract in one call. */
async function askWikipedia(query: string, signal: AbortSignal): Promise<Answer> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '1',
    prop: 'extracts|info',
    exintro: '1',
    explaintext: '1',
    exsentences: '4',
    inprop: 'url',
    redirects: '1',
  })
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    signal,
    headers: { 'User-Agent': UA },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error('wiki')
  const page = (await res.json())?.query?.pages?.[0]
  const text: string | undefined = page?.extract?.trim()
  if (!text) throw new Error('wiki-empty')
  return { answer: text, source: 'Wikipedia', url: page.fullurl }
}

/**
 * Optional plug point — open-source AI via Hugging Face Inference Providers.
 * Only used as a last resort when HF_TOKEN is set; DuckDuckGo + Wikipedia work without any keys.
 */
async function askHuggingFace(query: string, signal: AbortSignal): Promise<Answer | null> {
  const token = process.env.HF_TOKEN
  if (!token) return null
  const model = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2'
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Reply with a direct, factual answer in at most 4 sentences. No preamble.' },
        { role: 'user', content: query },
      ],
    }),
  })
  if (!res.ok) return null
  const text: string | undefined = (await res.json())?.choices?.[0]?.message?.content?.trim()
  return text ? { answer: text, source: model.split('/').pop() ?? 'Open-source AI' } : null
}

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }

export async function GET(req: Request) {
  const query = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 300)
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const ddg = askDuckDuckGo(query, controller.signal)
    const wiki = askWikipedia(query, controller.signal)

    // DuckDuckGo's direct "Answer" is the most precise; otherwise take whichever source responds first.
    const best = await Promise.any([ddg, wiki]).catch(() => null)
    if (best) {
      controller.abort()
      return NextResponse.json(best, { headers: CACHE_HEADERS })
    }

    const ai = await askHuggingFace(query, AbortSignal.timeout(TIMEOUT_MS)).catch(() => null)
    if (ai) return NextResponse.json(ai, { headers: CACHE_HEADERS })

    return NextResponse.json({
      answer: 'No precise answer found. Try a more specific subject, for example "speed of light".',
      source: 'Spidensh',
      found: false,
    })
  } finally {
    clearTimeout(timer)
  }
}
