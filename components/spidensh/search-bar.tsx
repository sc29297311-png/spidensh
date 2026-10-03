'use client'

import { ArrowRight, Loader2, Search } from 'lucide-react'
import { useState } from 'react'

export function SearchBar({
  onSearch,
  loading,
  defaultValue = '',
}: {
  onSearch: (query: string) => void
  loading: boolean
  defaultValue?: string
}) {
  const [value, setValue] = useState(defaultValue)

  function submit() {
    const q = value.trim()
    if (q) onSearch(q)
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="glass relative flex items-center gap-2 overflow-hidden rounded-2xl pl-4 pr-1.5 py-1.5 focus-within:neon-ring transition-shadow"
    >
      <Search className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <label htmlFor="spidensh-q" className="sr-only">
        Ask Spidensh
      </label>
      <input
        id="spidensh-q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) e.stopPropagation()
        }}
        placeholder="Ask anything..."
        autoComplete="off"
        autoFocus
        className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        aria-label="Search"
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
      </button>
      {loading && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden">
          <span className="block h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
        </span>
      )}
    </form>
  )
}
