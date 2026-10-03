import { NextResponse } from 'next/server'

type Answer = { answer: string; source: string; url?: string }

const UA = 'Spidensh/1.0 (answer engine prototype)'
const TIMEOUT_MS = 6000

/**
 * PLUG POINT — Free open-source AI inference (Hugging Face Inference Providers, OpenAI-compatible).
 * Set HF_TOKEN (and optionally HF_MODEL, e.g. "mistralai/Mistral-7B-Instruct-v0.2") in project Vars
 * to enable it. Without a token, Spidensh answers from free knowledge APIs below.
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
        {
          role: 'system',
          content:
            'You are Spidensh, a precise answer engine. Reply with a direct, factual answer in at most 4 sentences. No preamble.',
        },
        { role: 'user', content: query },
      ],
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const text: string | undefined = data?.choices?.[0]?.message?.content?.trim()
  return text ? { answer: text, source: model.split('/').pop() ?? 'Open-source AI' } : null
}

async function askDuckDuckGo(query: string, signal: AbortSignal): Promise<Answer | null> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  const res = await fetch(url, { signal, headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const data = await res.json()
  const text: string = data.Answer || data.AbstractText || data.Definition || ''
  if (!text) return null
  return { answer: text, source: data.AbstractSource || 'DuckDuckGo', url: data.AbstractURL || undefined }
}

async function askWikipedia(query: string, signal: AbortSignal): Promise<Answer | null> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(query)}`
  const sres = await fetch(searchUrl, { signal, headers: { 'User-Agent': UA } })
  if (!sres.ok) return null
  const title: string | undefined = (await sres.json())?.query?.search?.[0]?.title
  if (!title) return null
  const pres = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    { signal, headers: { 'User-Agent': UA } },
  )
  if (!pres.ok) return null
  const page = await pres.json()
  if (!page.extract) return null
  return { answer: page.extract, source: 'Wikipedia', url: page.content_urls?.desktop?.page }
}

const safe = (p: Promise<Answer | null>) => p.catch(() => null)

export async function POST(req: Request) {
  let query = ''
  try {
    const body = await req.json()
    query = typeof body?.query === 'string' ? body.query.trim().slice(0, 300) : ''
  } catch {}
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const ai = await safe(askHuggingFace(query, controller.signal))
    if (ai) return NextResponse.json(ai)

    // Race both free sources in parallel; prefer DuckDuckGo's direct answer, then Wikipedia.
    const [ddg, wiki] = await Promise.all([
      safe(askDuckDuckGo(query, controller.signal)),
      safe(askWikipedia(query, controller.signal)),
    ])
    const best = ddg ?? wiki
    if (best) return NextResponse.json(best)

    return NextResponse.json({
      answer: 'No precise answer found. Try rephrasing with a specific subject, for example "speed of light".',
      source: 'Spidensh',
    })
  } finally {
    clearTimeout(timer)
  }
}
