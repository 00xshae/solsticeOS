import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Collapsible inspector section; the body fades in when opened. */
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
    <section className="border-b border-border">
      <div className="flex items-center gap-2 bg-section px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-secondary transition-colors duration-150 hover:text-primary"
        >
          <ChevronDown className={cn('size-3.5 transition-transform duration-200 ease-in-out', !open && '-rotate-90')} />
          {title}
        </button>
        {aside}
      </div>
      {open && <div className="animate-section-in">{children}</div>}
    </section>
  )
}

/** Label-over-value cell for detail grids. */
export function Field({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-medium uppercase tracking-widest text-tertiary">{label}</div>
      <div className={cn('truncate text-[13px] text-primary', mono && 'font-mono font-medium tabular-nums')}>{value ?? '—'}</div>
    </div>
  )
}
