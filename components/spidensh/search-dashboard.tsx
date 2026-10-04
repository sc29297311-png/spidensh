'use client'

import { History, LogOut } from 'lucide-react'
import { useRef, useState } from 'react'
import { logout } from '@/lib/spidensh/auth'
import { getEngine, readHistory, writeHistory } from '@/lib/spidensh/engine'
import { CacheMeter } from './cache-meter'
import { Logo } from './logo'
import { ResultBox, type SearchResult } from './result-box'
import { SearchBar } from './search-bar'

const SUGGESTIONS = ['Speed of light', 'Capital of Japan', 'What is photosynthesis', 'Alan Turing']

export function SearchDashboard({ user }: { user: { name: string; email: string } }) {
  const engine = getEngine()!
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>(() => readHistory())
  const [stats, setStats] = useState(() => engine.usage())
  const [barKey, setBarKey] = useState(0)
  const [barValue, setBarValue] = useState('')
  const requestId = useRef(0)

  async function runSearch(query: string) {
    const id = ++requestId.current
    setError(null)
    setHistory(writeHistory(query))

    const instant = engine.peek(query)
    if (instant) {
      setResult({ query, ...instant })
      return
    }

    setLoading(true)
    try {
      const res = await engine.search(query)
      if (id !== requestId.current) return
      setResult({ query, ...res })
      setStats(engine.usage())
      setTimeout(() => setStats(engine.usage()), 1500)
    } catch (err) {
      if (id !== requestId.current || (err instanceof DOMException && err.name === 'AbortError')) return
      setResult(null)
      setError('Could not reach the answer service. Please try again.')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  function pick(q: string) {
    setBarValue(q)
    setBarKey((k) => k + 1)
    runSearch(q)
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary neon-ring"
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-12 pt-10 sm:pt-16">
        <div className="text-center">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Ask once. <span className="text-primary neon-text">Know instantly.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm text-muted-foreground sm:text-base">
            Direct, precise answers. Repeat questions resolve from your private cache with zero network wait.
          </p>
        </div>

        <SearchBar key={barKey} defaultValue={barValue} onSearch={runSearch} loading={loading} />

        {!result && !error && (
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Suggested questions">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}

        <ResultBox result={result} error={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <CacheMeter
            {...stats}
            onClear={() => {
              engine.clearCache()
              setStats(engine.usage())
            }}
          />
          <section aria-label="Recent searches" className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <History className="size-4 text-primary" aria-hidden="true" />
              Recent
            </div>
            {history.length ? (
              <ul className="flex flex-col gap-1">
                {history.slice(0, 4).map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => pick(q)}
                      className="w-full truncate rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Your searches will appear here.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
