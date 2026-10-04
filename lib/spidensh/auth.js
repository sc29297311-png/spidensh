import { SPIDENSH_CONFIG } from './config.js'

/**
 * Spidensh auth — LOCAL ADAPTER.
 * Passwords and recovery keys are salted and hashed with PBKDF2-SHA256 (Web Crypto, 150k iterations)
 * and never stored in plain text. Accounts live in this browser only.
 *
 * Account recovery: at registration a one-time 100-bit Recovery Key is generated and shown once.
 * Email + Recovery Key lets the user set a new password; the key is then rotated, so each key works
 * exactly once. Failed attempts are rate-limited per email.
 *
 * PLUG POINT — For production, keep this module's public API and replace the bodies with calls to a
 * real backend (e.g. Better Auth on Neon with email-based reset). The React UI does not need to change.
 */

const { users: USERS_KEY, session: SESSION_KEY, recoveryAttempts: ATTEMPTS_KEY } = SPIDENSH_CONFIG.storageKeys
const ITERATIONS = 150_000
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENERIC_RECOVERY_ERROR = 'Recovery failed. Check your email and Recovery Key.'

const listeners = new Set()
let cachedSession
let cachedRaw

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)))
const cleanEmailOf = (email) => String(email).trim().toLowerCase()

function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function pbkdf2(secret, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256)
  return { salt: toHex(salt), hash: toHex(bits) }
}

function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b & 31]).join('')
  return chars.match(/.{5}/g).join('-')
}

/** Accepts lowercase, missing dashes, and common look-alikes (O->0, I/L->1). */
function normalizeRecoveryKey(input) {
  return String(input)
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '')
}

function validatePassword(password) {
  const p = String(password)
  if (p.length < 8) throw new Error('Password must be at least 8 characters.')
  if (p.length > 128) throw new Error('Password must be at most 128 characters.')
  return p
}

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

const writeUsers = (users) => localStorage.setItem(USERS_KEY, JSON.stringify(users))

function emit() {
  for (const l of listeners) l()
}

function startSession(user) {
  const session = { name: user.name, email: user.email, token: toHex(crypto.getRandomValues(new Uint8Array(16))) }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emit()
  return session
}

async function issueRecoveryKey(user) {
  const recoveryKey = generateRecoveryKey()
  const { salt, hash } = await pbkdf2(normalizeRecoveryKey(recoveryKey))
  user.recoverySalt = salt
  user.recoveryHash = hash
  return recoveryKey
}

/**
 * Creates the account and returns its one-time Recovery Key.
 * The session starts only when the caller invokes `activate()` after the user has saved the key.
 */
export async function register({ name, email, password }) {
  const cleanEmail = cleanEmailOf(email)
  const cleanName = String(name).trim().slice(0, 60)
  if (!cleanName) throw new Error('Please enter your name.')
  if (!EMAIL_RE.test(cleanEmail)) throw new Error('Please enter a valid email address.')
  const pwd = validatePassword(password)

  const users = readUsers()
  if (users[cleanEmail]) throw new Error('Unable to create account with these details.')
  const { salt, hash } = await pbkdf2(pwd)
  const user = { name: cleanName, email: cleanEmail, salt, hash, createdAt: Date.now() }
  const recoveryKey = await issueRecoveryKey(user)
  users[cleanEmail] = user
  writeUsers(users)
  return { recoveryKey, activate: () => startSession(user) }
}

export async function login({ email, password }) {
  const cleanEmail = cleanEmailOf(email)
  const user = readUsers()[cleanEmail]
  const { hash } = await pbkdf2(String(password), user?.salt ?? '00'.repeat(16))
  if (!user || !safeEqual(hash, user.hash)) throw new Error('Invalid email or password.')
  return startSession(user)
}

function readAttempts() {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function assertNotLocked(email) {
  const entry = readAttempts()[email]
  if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
    const mins = Math.ceil((entry.lockedUntil - Date.now()) / 60000)
    throw new Error(`Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`)
  }
}

function recordFailure(email) {
  const { maxAttempts, lockoutMs } = SPIDENSH_CONFIG.recovery
  const all = readAttempts()
  const entry = all[email]?.lockedUntil > Date.now() ? all[email] : { count: all[email]?.count ?? 0 }
  entry.count = (entry.count ?? 0) + 1
  if (entry.count >= maxAttempts) {
    entry.lockedUntil = Date.now() + lockoutMs
    entry.count = 0
  }
  all[email] = entry
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all))
}

function clearFailures(email) {
  const all = readAttempts()
  delete all[email]
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all))
}

/**
 * Resets the password using the one-time Recovery Key, rotates the key, and returns the new one.
 * Errors are deliberately generic so they don't reveal whether an email is registered.
 */
export async function recoverAccount({ email, recoveryKey, newPassword }) {
  const cleanEmail = cleanEmailOf(email)
  if (!EMAIL_RE.test(cleanEmail)) throw new Error('Please enter a valid email address.')
  const pwd = validatePassword(newPassword)
  assertNotLocked(cleanEmail)

  const users = readUsers()
  const user = users[cleanEmail]
  const { hash } = await pbkdf2(normalizeRecoveryKey(recoveryKey), user?.recoverySalt ?? '00'.repeat(16))
  if (!user?.recoveryHash || !safeEqual(hash, user.recoveryHash)) {
    recordFailure(cleanEmail)
    throw new Error(GENERIC_RECOVERY_ERROR)
  }

  const next = await pbkdf2(pwd)
  user.salt = next.salt
  user.hash = next.hash
  user.passwordChangedAt = Date.now()
  const newRecoveryKey = await issueRecoveryKey(user)
  writeUsers(users)
  clearFailures(cleanEmail)
  return { recoveryKey: newRecoveryKey, activate: () => startSession(user) }
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
