import { pushToTelegram } from './adapters.js'
import { SPIDENSH_CONFIG } from './config.js'

/**
 * Spidensh auth — LOCAL ADAPTER.
 * Passwords are salted and hashed with PBKDF2-SHA256 (Web Crypto, 150k iterations) and never stored
 * in plain text. Accounts live in this browser only, which is suitable for a prototype but is NOT
 * server-side security.
 *
 * PLUG POINT — To go to production, keep this module's public API (register / login / logout /
 * subscribe / getSnapshot) and replace the bodies with calls to a real backend (e.g. Better Auth on
 * Neon). The React UI does not need to change.
 */

const { users: USERS_KEY, session: SESSION_KEY } = SPIDENSH_CONFIG.storageKeys
const ITERATIONS = 150_000
const listeners = new Set()
let cachedSession
let cachedRaw

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)))

async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  )
  return { salt: toHex(salt), hash: toHex(bits) }
}

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function emit() {
  for (const l of listeners) l()
}

function startSession(user) {
  const session = { name: user.name, email: user.email, token: toHex(crypto.getRandomValues(new Uint8Array(16))) }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emit()
  return session
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function register({ name, email, password }) {
  const cleanEmail = String(email).trim().toLowerCase()
  const cleanName = String(name).trim().slice(0, 60)
  if (!cleanName) throw new Error('Please enter your name.')
  if (!EMAIL_RE.test(cleanEmail)) throw new Error('Please enter a valid email address.')
  if (String(password).length < 8) throw new Error('Password must be at least 8 characters.')

  const users = readUsers()
  if (users[cleanEmail]) throw new Error('Unable to create account with these details.')
  const { salt, hash } = await hashPassword(password)
  users[cleanEmail] = { name: cleanName, email: cleanEmail, salt, hash, createdAt: Date.now() }
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  pushToTelegram({ type: 'register', user: cleanEmail })
  return startSession(users[cleanEmail])
}

export async function login({ email, password }) {
  const cleanEmail = String(email).trim().toLowerCase()
  const user = readUsers()[cleanEmail]
  const { hash } = await hashPassword(String(password), user?.salt ?? '00'.repeat(16))
  if (!user || hash !== user.hash) throw new Error('Invalid email or password.')
  return startSession(user)
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
  emit()
}

export function subscribe(listener) {
  listeners.add(listener)
  const onStorage = (e) => e.key === SESSION_KEY && listener()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Stable snapshot for useSyncExternalStore. */
export function getSnapshot() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      cachedSession = raw ? JSON.parse(raw) : null
    } catch {
      cachedSession = null
    }
  }
  return cachedSession
}

export const LOADING = Symbol('loading')
export function getServerSnapshot() {
  return LOADING
}
