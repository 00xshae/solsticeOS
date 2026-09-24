import { useMemo, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { rsoById, sequencesOfWindow } from '@/data'
import { cn } from '@/lib/cn'
import { formatHms, formatUtc } from '@/lib/format'
import { isSequenceOpen, sequenceMetrics } from '@/lib/threat'
import { SeverityBadge } from '@/components/ui/Badge'
import { useDisplayMinute } from '@/hooks/useSeverity'
import { useWindowRating } from '@/hooks/useThreat'
import { selectWindowRating, useMissionStore } from '@/store/missionStore'
import type { ThreatWindow } from '@/types'

type SortKey = 'threat' | 'start' | 'duration' | 'deltaV'

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'threat', label: 'Threat', hint: 'Highest rating first' },
  { key: 'start', label: 'Start', hint: 'Soonest first' },
  { key: 'duration', label: 'Duration', hint: 'Shortest first' },
  { key: 'deltaV', label: 'Δv', hint: 'Cheapest first' },
]

const durationMs = (w: ThreatWindow) => Date.parse(w.end) - Date.parse(w.start)

/** Cheapest delta-v among the window's still-open sequences (all of them once closed). */
function cheapestDeltaV(w: ThreatWindow, nowMs: number) {
  const sequences = sequencesOfWindow.get(w.id)!
  const open = sequences.filter((s) => isSequenceOpen(s, nowMs))
  return Math.min(...(open.length ? open : sequences).map((s) => sequenceMetrics(s).deltaVMps))
}

function ThreatWindowRow({ window }: { window: ThreatWindow }) {
  const rating = useWindowRating(window)
  const minute = useDisplayMinute()
  const active = useMissionStore((s) => s.activeThreatWindowId === window.id)
  const selectThreatWindow = useMissionStore((s) => s.selectThreatWindow)
  const openRatingModal = useMissionStore((s) => s.openRatingModal)

  return (
    <li
      className={cn(
        'grid grid-cols-[auto_1fr_auto] items-center gap-3 border-l-2 px-3 py-2 transition-colors duration-150 ease-out',
        active ? 'border-accent bg-accent-muted' : 'border-transparent hover:bg-elevated',
      )}
    >
      <button
        type="button"
        onClick={() => openRatingModal({ kind: 'window', windowId: window.id })}
        title="Explain this rating"
        aria-label={`Threat rating ${rating ? Math.round(rating.rating) : 'closed'}: explain`}
        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <SeverityBadge index={rating?.rating ?? 0} muted={!rating} />
      </button>
      <button
        type="button"
        onClick={() => selectThreatWindow(active ? null : window.id)}
        aria-pressed={active}
        className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-owned">{rsoById.get(window.targetId)?.name}</div>
          <div className="truncate text-[12px] font-medium text-opposed">{rsoById.get(window.opposedId)?.name}</div>
        </div>
        <div className="text-right font-mono text-[10px] leading-4 tabular-nums text-tertiary">
          <div className="font-medium text-primary">{formatUtc(Date.parse(window.start), false)}</div>
          <div>{formatHms(durationMs(window))}</div>
          <div>{cheapestDeltaV(window, minute * 60_000).toFixed(2)} m/s</div>
        </div>
      </button>
    </li>
  )
}

/** Sortable Solstice-style Threat Windows: only pairs the current lists screen. */
export function ThreatWindowList({ windows, emptyText }: { windows: ThreatWindow[]; emptyText: string }) {
  const [sort, setSort] = useState<SortKey>('threat')
  const minute = useDisplayMinute()

  const sorted = useMemo(() => {
    const s = useMissionStore.getState()
    const key: Record<SortKey, (w: ThreatWindow) => number> = {
      threat: (w) => -(selectWindowRating(s, w)?.rating ?? -1),
      start: (w) => Date.parse(w.start),
      duration: durationMs,
      deltaV: (w) => cheapestDeltaV(w, minute * 60_000),
    }
    return [...windows].sort((a, b) => key[sort](a) - key[sort](b))
  }, [windows, sort, minute])

  return (
    <div>
      <div className="flex items-center gap-1 px-3 py-1.5" role="group" aria-label="Sort threat windows">
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
      </div>
      {sorted.length > 0 ? (
        <ul className="divide-y divide-border">
          {sorted.map((w) => (
            <ThreatWindowRow key={w.id} window={w} />
          ))}
        </ul>
      ) : (
        <p className="px-3 pb-3 text-[12px] text-tertiary">{emptyText}</p>
      )}
    </div>
  )
}
