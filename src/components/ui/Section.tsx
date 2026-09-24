import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Collapsible inspector section with a mono uppercase title. */
export function Section({
  title,
  aside,
  defaultOpen = true,
  children,
}: {
  title: string
  aside?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-line">
      <div className="flex items-center gap-2 bg-panel-raised/40 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 text-left font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted hover:text-ink"
        >
          <ChevronDown className={cn('size-3.5 transition-transform', !open && '-rotate-90')} />
          {title}
        </button>
        {aside}
      </div>
      {open && children}
    </section>
  )
}

/** Label-over-value cell for detail grids. */
export function Field({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">{label}</div>
      <div className={cn('truncate text-[13px] text-ink', mono && 'font-mono tabular-nums')}>{value ?? '—'}</div>
    </div>
  )
}
