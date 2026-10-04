import { ExternalLink, Zap } from 'lucide-react'

export type SearchResult = {
  query: string
  answer: string
  source: string
  url?: string
  instant: boolean
  latencyMs: number
}

export function ResultBox({ result, error }: { result: SearchResult | null; error: string | null }) {
  if (error) {
    return (
      <div role="alert" className="glass rounded-2xl p-5 text-sm text-destructive">
        {error}
      </div>
    )
  }
  if (!result) return null

  return (
    <article aria-live="polite" className="glass rounded-2xl p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-pretty">{result.query}</h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] ${
            result.instant ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'
          }`}
        >
          <Zap className="size-3" aria-hidden="true" />
          {result.instant ? 'instant' : `${Math.round(result.latencyMs)} ms`}
        </span>
      </header>

      <p className="text-base leading-relaxed text-pretty sm:text-lg">{result.answer}</p>

      <footer className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>Source</span>
        {result.url ? (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {result.source}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-foreground">{result.source}</span>
        )}
      </footer>
    </article>
  )
}
