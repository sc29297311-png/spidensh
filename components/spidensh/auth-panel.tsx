'use client'

import { Check, Copy, KeyRound, Loader2, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { useState } from 'react'
import { login, recoverAccount, register } from '@/lib/spidensh/auth'
import { Logo } from './logo'

type Mode = 'login' | 'register' | 'recover'
type PendingKey = { recoveryKey: string; activate: () => void; reason: 'register' | 'recover' }

const TITLES: Record<Mode, string> = {
  login: 'Sign in to Spidensh',
  register: 'Create a Spidensh account',
  recover: 'Recover your account',
}

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [issued, setIssued] = useState<PendingKey | null>(null)

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(e.currentTarget)
    const get = (k: string) => String(form.get(k) ?? '')
    try {
      if (mode === 'register') {
        const res = await register({ name: get('name'), email: get('email'), password: get('password') })
        setIssued({ ...res, reason: 'register' })
      } else if (mode === 'recover') {
        if (get('password') !== get('confirm')) throw new Error('Passwords do not match.')
        const res = await recoverAccount({
          email: get('email'),
          recoveryKey: get('recoveryKey'),
          newPassword: get('password'),
        })
        setIssued({ ...res, reason: 'recover' })
      } else {
        await login({ email: get('email'), password: get('password') })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10">
      <div className="flex flex-col items-center gap-3 mb-8 text-center">
        <Logo size="lg" />
        <p className="text-sm text-muted-foreground max-w-xs text-pretty">
          Precision answers in milliseconds. Sign in to unlock your private answer vault.
        </p>
      </div>

      <section className="glass w-full max-w-sm rounded-2xl p-6" aria-labelledby="auth-title">
        {issued ? (
          <RecoveryKeyNotice issued={issued} />
        ) : (
          <>
            {mode !== 'recover' ? (
              <div
                role="tablist"
                aria-label="Account"
                className="grid grid-cols-2 gap-1 rounded-lg bg-background/60 p-1 mb-6"
              >
                {(['login', 'register'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={`rounded-md py-2 text-sm font-medium transition-colors ${
                      mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m === 'login' ? 'Sign in' : 'Register'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-5 flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <KeyRound className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">Account recovery</p>
                  <p className="text-xs text-muted-foreground text-pretty">
                    Enter the Recovery Key you saved when you registered, then choose a new password.
                  </p>
                </div>
              </div>
            )}

            <h1 id="auth-title" className="sr-only">
              {TITLES[mode]}
            </h1>

            <form key={mode} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              {mode === 'register' && (
                <Field icon={<User className="size-4" />} label="Name" name="name" type="text" autoComplete="name" />
              )}
              <Field icon={<Mail className="size-4" />} label="Email" name="email" type="email" autoComplete="email" />
              {mode === 'recover' && (
                <Field
                  icon={<KeyRound className="size-4" />}
                  label="Recovery Key"
                  name="recoveryKey"
                  type="text"
                  autoComplete="off"
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                  mono
                />
              )}
              <Field
                icon={<Lock className="size-4" />}
                label={mode === 'recover' ? 'New password' : 'Password'}
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                hint={mode !== 'login' ? 'At least 8 characters' : undefined}
              />
              {mode === 'recover' && (
                <Field
                  icon={<Lock className="size-4" />}
                  label="Confirm new password"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                />
              )}

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('recover')}
                  className="-mt-2 self-end text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-medium text-primary-foreground shadow-[0_0_24px_-4px_var(--primary)] transition hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'}
              </button>

              {mode === 'recover' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </button>
              )}
            </form>
          </>
        )}
      </section>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
        PBKDF2-SHA256 · one-time recovery keys
      </p>
    </main>
  )
}

function RecoveryKeyNotice({ issued }: { issued: PendingKey }) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.recoveryKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <KeyRound className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h1 id="auth-title" className="font-medium">
            {issued.reason === 'register' ? 'Save your Recovery Key' : 'Password updated'}
          </h1>
          <p className="text-xs text-muted-foreground text-pretty">
            {issued.reason === 'register'
              ? 'This key is the only way to reset your password. It is shown once.'
              : 'Your old Recovery Key no longer works. Save this new one.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-background/60 p-3 neon-ring">
        <code className="flex-1 break-all text-center font-mono text-sm tracking-wider text-primary">
          {issued.recoveryKey}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy Recovery Key'}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {copied ? <Check className="size-4 text-accent" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        I have saved my Recovery Key somewhere safe
      </label>

      <button
        type="button"
        disabled={!saved}
        onClick={issued.activate}
        className="rounded-lg bg-primary py-2.5 font-medium text-primary-foreground shadow-[0_0_24px_-4px_var(--primary)] transition hover:brightness-110 disabled:opacity-50"
      >
        Continue to Spidensh
      </button>
    </div>
  )
}

function Field({
  icon,
  label,
  name,
  type,
  autoComplete,
  hint,
  placeholder,
  mono,
}: {
  icon: React.ReactNode
  label: string
  name: string
  type: string
  autoComplete: string
  hint?: string
  placeholder?: string
  mono?: boolean
}) {
  const id = `auth-${name}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background/50 px-3 focus-within:neon-ring transition-shadow">
        <span className="text-primary" aria-hidden="true">
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={type}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          spellCheck={false}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 ${
            mono ? 'font-mono uppercase tracking-wider' : ''
          }`}
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}
