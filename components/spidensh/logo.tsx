export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const big = size === 'lg'
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`relative grid place-items-center rounded-lg neon-ring bg-primary/10 ${big ? 'size-11' : 'size-8'}`}
      >
        <span className={`rounded-full bg-primary ${big ? 'size-3' : 'size-2'} shadow-[0_0_14px_var(--primary)]`} />
        <span className="absolute inset-1.5 rounded-md border border-primary/40" />
      </span>
      <span className={`font-semibold tracking-tight ${big ? 'text-3xl' : 'text-lg'}`}>
        Spiden<span className="text-primary neon-text">sh</span>
      </span>
    </div>
  )
}
