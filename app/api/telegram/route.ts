import { NextResponse } from 'next/server'

/**
 * Telegram Bot API storage for Spidensh index + cache records.
 * Setup: create a bot with @BotFather, add it as admin to a private channel or group, then set
 * TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in project Vars.
 *
 *   GET                 -> { configured }
 *   POST {signature, record} -> uploads JSON document, returns { fileId, messageId }
 *   GET  ?fileId=...    -> downloads a stored record
 *   DELETE ?messageId=  -> removes an evicted record from the chat
 */

const MAX_BODY = 64 * 1024
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/
const SIG_RE = /^[a-z0-9.]{1,200}$/

function creds() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  return token && chatId ? { token, chatId } : null
}

const api = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`

export async function GET(req: Request) {
  const c = creds()
  const fileId = new URL(req.url).searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ configured: Boolean(c) })
  if (!c) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  if (!FILE_ID_RE.test(fileId)) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const meta = await fetch(`${api(c.token, 'getFile')}?file_id=${fileId}`).then((r) => r.json()).catch(() => null)
  const path: string | undefined = meta?.result?.file_path
  if (!meta?.ok || !path || (meta.result.file_size ?? 0) > MAX_BODY) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const file = await fetch(`https://api.telegram.org/file/bot${c.token}/${path}`).catch(() => null)
  if (!file?.ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  try {
    const { record } = JSON.parse(await file.text())
    if (typeof record?.answer !== 'string') throw new Error('shape')
    return NextResponse.json(
      { record: { answer: record.answer, source: String(record.source ?? ''), url: record.url } },
      { headers: { 'Cache-Control': 'private, max-age=3600' } },
    )
  } catch {
    return NextResponse.json({ error: 'corrupt' }, { status: 422 })
  }
}

export async function POST(req: Request) {
  const c = creds()
  if (!c) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const raw = await req.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'too_large' }, { status: 413 })

  let signature: unknown
  let record: Record<string, unknown>
  try {
    ;({ signature, record } = JSON.parse(raw))
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (typeof signature !== 'string' || !SIG_RE.test(signature) || typeof record?.answer !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const clean = {
    signature,
    record: {
      answer: String(record.answer).slice(0, 4000),
      source: String(record.source ?? '').slice(0, 100),
      url: typeof record.url === 'string' && record.url.startsWith('https://') ? record.url.slice(0, 500) : undefined,
      query: String(record.query ?? '').slice(0, 200),
      t: Date.now(),
    },
  }

  const form = new FormData()
  form.append('chat_id', c.chatId)
  form.append('disable_notification', 'true')
  form.append('caption', `#spidensh_index ${signature.slice(0, 64)}`)
  form.append('document', new Blob([JSON.stringify(clean)], { type: 'application/json' }), `${signature.slice(0, 64)}.json`)

  const res = await fetch(api(c.token, 'sendDocument'), { method: 'POST', body: form })
  const data = await res.json().catch(() => null)
  if (!data?.ok) return NextResponse.json({ error: 'telegram_rejected' }, { status: 502 })
  return NextResponse.json({ fileId: data.result.document.file_id, messageId: data.result.message_id })
}

export async function DELETE(req: Request) {
  const c = creds()
  if (!c) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  const messageId = Number(new URL(req.url).searchParams.get('messageId'))
  if (!Number.isInteger(messageId) || messageId <= 0) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const res = await fetch(api(c.token, 'deleteMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: c.chatId, message_id: messageId }),
  })
  return NextResponse.json({ deleted: res.ok })
}
