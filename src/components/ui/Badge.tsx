import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { severityBand } from '@/lib/severity'
import type { RsoListCategory, SeverityBand } from '@/types'
import { CATEGORY_LABEL } from '@/lib/format'

const CATEGORY_CLASS: Record<RsoListCategory, string> = {
  protected: 'border-protected/50 text-protected',
  cooperative: 'border-cooperative/50 text-cooperative',
  uncooperative: 'border-uncooperative/50 text-uncooperative',
}

export function CategoryChip({ category, className }: { category: RsoListCategory; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase leading-none tracking-wider',
        CATEGORY_CLASS[category],
        className,
      )}
    >
      {CATEGORY_LABEL[category]}
    </span>
  )
}

// Yellow keeps dark text: white on #eab308 is unreadable. `--glow` feeds the dark-mode halo.
const BAND_CLASS: Record<SeverityBand, string> = {
  green: 'bg-sev-green [--glow:var(--color-sev-green)]',
  blue: 'bg-sev-blue [--glow:var(--color-sev-blue)]',
  yellow: 'bg-sev-yellow text-stone-950 [--glow:var(--color-sev-yellow)]',
  orange: 'bg-sev-orange [--glow:var(--color-sev-orange)]',
  red: 'bg-sev-red [--glow:var(--color-sev-red)]',
}

/**
 * Rounded 0-100 index tile in its severity band colour. `muted` greys it out, e.g. once a
 * conjunction window has closed. The value pulses briefly when it changes.
 */
export function SeverityBadge({
  index,
  size = 'sm',
  muted = false,
  className,
}: {
  index: number
  size?: 'sm' | 'lg'
  muted?: boolean
  className?: string
}) {
  const value = Math.round(index)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])

  return (
    <span
      className={cn(
        'inline-grid place-items-center font-mono tabular-nums text-white transition-colors duration-150',
        size === 'sm' ? 'h-6 min-w-7 rounded-md px-1 text-xs font-semibold' : 'h-12 min-w-12 rounded-lg px-2 text-2xl font-bold',
        muted ? 'bg-elevated text-tertiary' : cn(BAND_CLASS[severityBand(index)], 'dark:glow'),
        className,
      )}
    >
      <span key={value} className={cn(mounted.current && 'animate-value-pulse')}>
        {value}
      </span>
    </span>
  )
}

export function Pill({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'info' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase leading-none tracking-wide',
        tone === 'ok' && 'border-sev-green/30 bg-sev-green/[0.06] text-sev-green-ink',
        tone === 'warn' && 'border-sev-yellow/30 bg-sev-yellow/[0.06] text-sev-yellow-ink',
        tone === 'info' && 'border-accent/30 bg-accent-muted text-accent',
      )}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-current" />
      {children}
    </span>
  )
}
