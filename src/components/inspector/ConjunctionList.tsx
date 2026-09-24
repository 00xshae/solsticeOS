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
          'grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-l-2 px-3 py-2 text-left transition-colors duration-150 ease-out',
          active ? 'border-accent bg-accent-muted' : 'border-transparent hover:bg-elevated',
        )}
      >
        <SeverityBadge index={severity.index} muted={!isConjunctionOpen(event, minute * 60_000)} />
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-owned">{primary?.name}</div>
          <div className="truncate text-[12px] font-medium text-opposed">{secondary?.name}</div>
        </div>
        <div className="text-right font-mono text-[10px] leading-4 tabular-nums text-tertiary">
          <div className="font-medium text-primary">{formatCountdown(Date.parse(event.tca), minute * 60_000)}</div>
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
          {sorted.map((e) => (
            <ConjunctionRow key={e.id} event={e} />
          ))}
        </ul>
      ) : (
        <p className="px-3 pb-3 text-[12px] text-tertiary">{emptyText}</p>
      )}
    </div>
  )
}
