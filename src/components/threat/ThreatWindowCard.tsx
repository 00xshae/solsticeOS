import { useMemo, useState } from 'react'
import { ArrowDownUp, X } from 'lucide-react'
import { rsoById, sequencesOfWindow } from '@/data'
import { cn } from '@/lib/cn'
import { formatHms, formatUtc, OBJECT_TYPE, SEVERITY_HEX } from '@/lib/format'
import { isSequenceOpen, sequenceMetrics } from '@/lib/threat'
import { CategoryChip, SeverityBadge } from '@/components/ui/Badge'
import { Field, Section } from '@/components/ui/Section'
import { useCategories } from '@/hooks/useCategories'
import { useDisplayMinute } from '@/hooks/useSeverity'
import { useWindowRating } from '@/hooks/useThreat'
import { useMissionStore } from '@/store/missionStore'
import type { InterceptSequence, RSOObject, ThreatWindow } from '@/types'
import { BAND_TEXT } from './ThreatBreakdown'

function Party({ object, side }: { object: RSOObject; side: 'target' | 'opposed' }) {
  const categories = useCategories(object.id)
  const category = side === 'opposed' ? 'opposed' : categories.includes('owned') ? 'owned' : 'allied'
  return (
    <div className={cn('min-w-0', side === 'opposed' && 'text-right')}>
      <CategoryChip category={category} />
      <div className="mt-1 truncate text-[13px] font-medium text-primary">{object.name}</div>
      <div className="font-mono text-[10px] text-tertiary">
        {object.noradId} · {OBJECT_TYPE[object.segment]}
      </div>
    </div>
  )
}

type SortKey = 'deltaV' | 'duration' | 'end'

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'deltaV', label: 'Δv', hint: 'Cheapest: least delta-v first' },
  { key: 'duration', label: 'Duration', hint: 'Quickest: shortest transit first' },
  { key: 'end', label: 'End', hint: 'Soonest: earliest arrival first' },
]

function SequenceRow({ sequence, open }: { sequence: InterceptSequence; open: boolean }) {
  const active = useMissionStore((s) => s.activeInterceptId === sequence.id)
  const selectIntercept = useMissionStore((s) => s.selectIntercept)
  const m = sequenceMetrics(sequence)
  return (
    <li>
      <button
        type="button"
        onClick={() => selectIntercept(sequence.id)}
        aria-pressed={active}
        className={cn(
          'grid w-full grid-cols-[1fr_auto] items-center gap-2 border-l-2 px-3 py-1.5 text-left transition-colors duration-150',
          active ? 'border-accent bg-accent-muted' : 'border-transparent hover:bg-elevated',
          !open && 'opacity-45',
        )}
        title={open ? undefined : 'Burn 1 has passed'}
      >
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-primary">{sequence.name}</div>
          <div className="font-mono text-[10px] tabular-nums text-tertiary">
            B1 {formatUtc(m.burn1Ms, false).slice(5)} → {formatUtc(m.arrivalMs, false).slice(5)}
          </div>
        </div>
        <div className="text-right font-mono text-[10px] leading-4 tabular-nums">
          <div className="font-medium text-primary">{m.deltaVMps.toFixed(2)} m/s</div>
          <div className="text-tertiary">{formatHms(m.transitS * 1000)}</div>
        </div>
      </button>
    </li>
  )
}

/** Burn-coast-burn intercepts for the window, sortable by what each sort answers. */
function SequenceList({ window }: { window: ThreatWindow }) {
  const [sort, setSort] = useState<SortKey>('end')
  const minute = useDisplayMinute()
  const sequences = sequencesOfWindow.get(window.id)!
  const sorted = useMemo(() => {
    const key: Record<SortKey, (s: InterceptSequence) => number> = {
      deltaV: (s) => sequenceMetrics(s).deltaVMps,
      duration: (s) => sequenceMetrics(s).transitS,
      end: (s) => sequenceMetrics(s).arrivalMs,
    }
    return [...sequences].sort((a, b) => key[sort](a) - key[sort](b))
  }, [sequences, sort])
  const openCount = sequences.filter((s) => isSequenceOpen(s, minute * 60_000)).length

  return (
    <Section
      title={`Manoeuvre sequences · ${sequences.length}`}
      info="Feasible burn-coast-burn intercepts for this window, sortable by cheapest delta-v, quickest transit or soonest arrival."
    >
      <div className="flex items-center gap-1 px-3 py-1.5" role="group" aria-label="Sort sequences">
        <ArrowDownUp className="mr-1 size-3 text-tertiary" />
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            title={s.hint}
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors duration-100 ease-out',
              sort === s.key ? 'bg-accent-muted text-accent' : 'text-tertiary hover:bg-elevated hover:text-primary',
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-tertiary">{openCount} open</span>
      </div>
      <ul className="max-h-72 divide-y divide-border overflow-y-auto">
        {sorted.map((s) => (
          <SequenceRow key={s.id} sequence={s} open={isSequenceOpen(s, minute * 60_000)} />
        ))}
      </ul>
    </Section>
  )
}

/** Selected threat window: rating, the pair, timing and its manoeuvre sequences. */
export function ThreatWindowCard({ window }: { window: ThreatWindow }) {
  const rating = useWindowRating(window)
  const selectThreatWindow = useMissionStore((s) => s.selectThreatWindow)
  const openRatingModal = useMissionStore((s) => s.openRatingModal)
  const target = rsoById.get(window.targetId)!
  const opposed = rsoById.get(window.opposedId)!
  const color = rating ? SEVERITY_HEX[rating.band] : 'transparent'
  const start = Date.parse(window.start)
  const end = Date.parse(window.end)

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: rating ? `${color}14` : undefined }}>
        <button
          type="button"
          onClick={() => openRatingModal({ kind: 'window', windowId: window.id })}
          title="Explain this rating"
          className="flex flex-1 items-center gap-3 text-left"
        >
          <SeverityBadge index={rating?.rating ?? 0} size="lg" muted={!rating} />
          <div>
            <div className={cn('font-mono text-lg font-semibold tabular-nums', rating ? BAND_TEXT[rating.band] : 'text-tertiary')}>
              {rating ? `${Math.round(rating.rating)}/100` : 'Closed'}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-tertiary">
              {rating ? 'Window threat rating · tap to explain' : 'Every Burn 1 has passed'}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => selectThreatWindow(null)}
          aria-label="Close threat window"
          className="self-start rounded-md p-1 text-tertiary hover:bg-elevated hover:text-primary"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border px-3 py-3">
        <Party object={target} side="target" />
        <Party object={opposed} side="opposed" />
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border px-3 py-3">
        <Field label="Start (UTC)" value={formatUtc(start)} />
        <Field label="End (UTC)" value={formatUtc(end)} />
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-border px-3 py-3">
        <Field label="Duration" value={formatHms(end - start)} />
        <Field label="Delta v" value={rating ? `${rating.cheapestDeltaVMps.toFixed(2)} m/s` : '—'} />
        <Field label="Transfer type" value={window.transferType === 'PHASING' ? 'Phasing' : 'Lambert'} mono={false} />
      </div>

      <p className="border-t border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-secondary">
        {window.reasoning ?? 'NO RECORDED REASONING FOR THIS WINDOW.'}
      </p>

      <SequenceList window={window} />
    </div>
  )
}
