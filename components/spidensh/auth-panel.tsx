'use client'

import { Loader2, Lock, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { login, register } from '@/lib/spidensh/auth'
import { Logo } from './logo'

type Mode = 'login' | 'register'

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(e.currentTarget)
    const payload = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    }
    try {
      if (mode === 'register') await register(payload)
      else await login(payload)
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
          Precision answers in milliseconds. Sign in to unlock your private answer cache.
        </p>
      </div>

      <section className="glass w-full max-w-sm rounded-2xl p-6" aria-labelledby="auth-title">
        <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1 rounded-lg bg-background/60 p-1 mb-6">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${
                mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <h1 id="auth-title" className="sr-only">
          {mode === 'login' ? 'Sign in to Spidensh' : 'Create a Spidensh account'}
        </h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {mode === 'register' && (
            <Field icon={<User className="size-4" />} label="Name" name="name" type="text" autoComplete="name" />
          )}
          <Field icon={<Mail className="size-4" />} label="Email" name="email" type="email" autoComplete="email" />
          <Field
            icon={<Lock className="size-4" />}
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            hint={mode === 'register' ? 'At least 8 characters' : undefined}
          />

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
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>

      <p className="mt-6 text-xs text-muted-foreground font-mono">secured with PBKDF2-SHA256</p>
    </main>
  )
}

function Field({
  icon,
  label,
  name,
  type,
  autoComplete,
  hint,
}: {
  icon: React.ReactNode
  label: string
  name: string
  type: string
  autoComplete: string
  hint?: string
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
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
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
