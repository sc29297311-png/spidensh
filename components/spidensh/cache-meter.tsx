import { Database, Trash2 } from 'lucide-react'

export function CacheMeter({
  bytes,
  maxBytes,
  hasData,
  onClear,
}: {
  bytes: number
  maxBytes: number
  hasData: boolean
  onClear: () => void
}) {
  const pct = Math.min(100, (bytes / maxBytes) * 100)
  return (
    <section aria-label="Answer vault" className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Database className="size-4 text-primary" aria-hidden="true" />
          Answer vault
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasData}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
        >
          <Trash2 className="size-3" aria-hidden="true" />
          Clear
        </button>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Vault usage"
        className="h-1.5 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_10px_var(--primary)] transition-[width]"
          style={{ width: `${Math.max(pct, hasData ? 1 : 0)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {hasData ? 'Repeat questions resolve instantly.' : 'Your vault fills as you search.'}
      </p>
    </section>
  )
}
