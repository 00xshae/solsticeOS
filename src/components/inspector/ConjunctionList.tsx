import { useMemo, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { rsoById } from '@/data'
import { cn } from '@/lib/cn'
import { formatCountdown, formatKm, formatPc } from '@/lib/format'
import { SeverityBadge } from '@/components/ui/Badge'
import { useDisplayMinute, useSeverity } from '@/hooks/useSeverity'
import { isConjunctionOpen } from '@/lib/severity'
import { selectSeverity, useMissionStore } from '@/store/missionStore'
import type { ConjunctionEvent } from '@/types'

type SortKey = 'severity' | 'tca' | 'miss' | 'pc'

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'severity', label: 'CSI', hint: 'Most severe first' },
  { key: 'tca', label: 'TCA', hint: 'Soonest first' },
  { key: 'miss', label: 'Miss', hint: 'Closest first' },
  { key: 'pc', label: 'Pc', hint: 'Most probable first' },
]

function ConjunctionRow({ event }: { event: ConjunctionEvent }) {
  const severity = useSeverity(event)
  const minute = useDisplayMinute()
  const active = useMissionStore((s) => s.activeConjunctionId === event.id)
  const selectConjunction = useMissionStore((s) => s.selectConjunction)
  const primary = rsoById.get(event.primaryId)
  const secondary = rsoById.get(event.secondaryId)

  return (
    <li>
      <button
        type="button"
        onClick={() => selectConjunction(active ? null : event.id)}
        aria-pressed={active}
        className={cn(
          'grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-l-2 px-3 py-2 text-left',
          active ? 'border-protected bg-protected/10' : 'border-transparent hover:bg-panel-raised',
        )}
      >
        <SeverityBadge index={severity.index} muted={!isConjunctionOpen(event, minute * 60_000)} />
        <div className="min-w-0">
          <div className="truncate text-[12px] text-protected">{primary?.name}</div>
          <div className="truncate text-[12px] text-uncooperative">{secondary?.name}</div>
        </div>
        <div className="text-right font-mono text-[10px] leading-4 tabular-nums text-ink-muted">
          <div className="text-ink">{formatCountdown(Date.parse(event.tca), minute * 60_000)}</div>
          <div>{formatKm(event.missDistanceM)}</div>
          <div>Pc {formatPc(event.pc)}</div>
        </div>
      </button>
    </li>
  )
}

/** Sortable conjunction windows; the Orbital Rakshak take on Solstice "Threat Windows". */
export function ConjunctionList({ events, emptyText }: { events: ConjunctionEvent[]; emptyText: string }) {
  const [sort, setSort] = useState<SortKey>('severity')
  const minute = useDisplayMinute()
  const radius = useMissionStore((s) => s.screeningRadiusOverrideKm)

  const sorted = useMemo(() => {
    const s = useMissionStore.getState()
    const key: Record<SortKey, (e: ConjunctionEvent) => number> = {
      severity: (e) => -selectSeverity(s, e).index,
      tca: (e) => Date.parse(e.tca),
      miss: (e) => e.missDistanceM,
      pc: (e) => -e.pc,
    }
    return [...events].sort((a, b) => key[sort](a) - key[sort](b))
  }, [events, sort, minute, radius])

  return (
    <div>
      <div className="flex items-center gap-1 px-3 py-1.5" role="group" aria-label="Sort conjunctions">
        <ArrowDownUp className="mr-1 size-3 text-ink-faint" />
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            title={s.hint}
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
              sort === s.key ? 'bg-protected/15 text-protected' : 'text-ink-faint hover:text-ink',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sorted.length > 0 ? (
        <ul className="divide-y divide-line/50">
          {sorted.map((e) => (
            <ConjunctionRow key={e.id} event={e} />
          ))}
        </ul>
      ) : (
        <p className="px-3 pb-3 text-[12px] text-ink-faint">{emptyText}</p>
      )}
    </div>
  )
}
