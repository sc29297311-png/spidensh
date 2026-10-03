import { NextResponse } from 'next/server'

/**
 * PLUG POINT — Telegram Bot API storage.
 * Set TELEGRAM_BOT_TOKEN (from @BotFather) and TELEGRAM_CHAT_ID (a private channel/group your bot
 * can post to) in project Vars. Each record is posted as a JSON message, giving you a free
 * append-only log of registrations and searches. Without the vars this route is a no-op.
 */
export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return NextResponse.json({ stored: false, reason: 'not_configured' })

  let record: Record<string, unknown>
  try {
    record = await req.json()
  } catch {
    return NextResponse.json({ stored: false, reason: 'invalid_body' }, { status: 400 })
  }

  const allowed = ['type', 'user', 'query', 'answer'] as const
  const clean = Object.fromEntries(
    allowed.filter((k) => typeof record[k] === 'string').map((k) => [k, String(record[k]).slice(0, 600)]),
  )
  const text = `#spidensh\n${JSON.stringify({ ...clean, at: new Date().toISOString() }, null, 2)}`

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_notification: true }),
  })
  return NextResponse.json({ stored: res.ok })
}
