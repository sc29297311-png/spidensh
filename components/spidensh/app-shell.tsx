'use client'

import { useSyncExternalStore } from 'react'
import { LOADING, getServerSnapshot, getSnapshot, subscribe } from '@/lib/spidensh/auth'
import { AuthPanel } from './auth-panel'
import { SearchDashboard } from './search-dashboard'

export function AppShell() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (session === LOADING) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <span className="sr-only">Loading Spidensh</span>
        <span className="size-3 animate-pulse rounded-full bg-primary shadow-[0_0_20px_var(--primary)]" />
      </div>
    )
  }

  return session ? <SearchDashboard user={session} /> : <AuthPanel />
}
