import type { ReactNode } from 'react'
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
        'inline-flex items-center rounded-full border px-2 py-px font-mono text-[10px] uppercase tracking-wider',
        CATEGORY_CLASS[category],
        className,
      )}
    >
      {CATEGORY_LABEL[category]}
    </span>
  )
}

const BAND_CLASS: Record<SeverityBand, string> = {
  green: 'bg-sev-green',
  blue: 'bg-sev-blue',
  yellow: 'bg-sev-yellow text-void',
  orange: 'bg-sev-orange',
  red: 'bg-sev-red',
}

/**
 * Rounded 0-100 index tile in its severity band colour. `muted` greys it out, e.g. once a
 * conjunction window has closed.
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
  return (
    <span
      className={cn(
        'inline-grid place-items-center rounded font-mono font-semibold tabular-nums text-white',
        size === 'sm' ? 'h-6 min-w-7 px-1 text-xs' : 'h-12 min-w-12 px-2 text-2xl',
        muted ? 'bg-panel-raised text-ink-faint' : BAND_CLASS[severityBand(index)],
        className,
      )}
    >
      {Math.round(index)}
    </span>
  )
}

export function Pill({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'info' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        tone === 'ok' && 'border-sev-green/40 text-sev-green',
        tone === 'warn' && 'border-sev-yellow/40 text-sev-yellow',
        tone === 'info' && 'border-protected/40 text-protected',
      )}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-current" />
      {children}
    </span>
  )
}
