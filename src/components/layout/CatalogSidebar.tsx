import { Search, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { rsoObjects } from '@/data'
import { cn } from '@/lib/cn'
import { SEGMENT_CODE, SEGMENT_LABEL } from '@/lib/format'
import { CategoryChip, SeverityBadge } from '@/components/ui/Badge'
import { useAggregateSeverity } from '@/hooks/useSeverity'
import {
  rsoCategories,
  selectFilteredObjects,
  useMissionStore,
  type SegmentFilter,
} from '@/store/missionStore'
import type { CatalogSegment, RSOObject } from '@/types'

const TABS: { id: SegmentFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  ...(['IND', 'PAY', 'RB', 'DEB'] as CatalogSegment[]).map((id) => ({ id, label: SEGMENT_LABEL[id] })),
]

const countBySegment = rsoObjects.reduce<Record<string, number>>(
  (acc, o) => ({ ...acc, [o.segment]: (acc[o.segment] ?? 0) + 1 }),
  { ALL: rsoObjects.length },
)

function useRowSeverity(object: RSOObject) {
  const categories = rsoCategories(object.id)
  const role = categories.includes('protected') ? 'vulnerable' : categories.includes('uncooperative') ? 'endangering' : null
  return useAggregateSeverity(object.id, role)
}

function CatalogRow({ object }: { object: RSOObject }) {
  const selected = useMissionStore((s) => s.selectedRsoId === object.id)
  const selectRso = useMissionStore((s) => s.selectRso)
  const severity = useRowSeverity(object)
  const [category] = rsoCategories(object.id)

  return (
    <li>
      <button
        type="button"
        onClick={() => selectRso(selected ? null : object.id)}
        aria-pressed={selected}
        className={cn(
          'flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left transition-colors',
          selected ? 'border-protected bg-protected/10' : 'border-transparent hover:bg-panel-raised',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-ink">{object.name}</div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-faint">
            <span>{object.noradId}</span>
            <span className="text-ink-muted">{SEGMENT_CODE[object.segment]}</span>
            {category && <CategoryChip category={category} className="px-1.5 text-[9px]" />}
          </div>
        </div>
        {severity ? (
          <SeverityBadge index={severity.index} />
        ) : (
          <span className="w-7 text-center font-mono text-xs text-ink-faint">–</span>
        )}
      </button>
    </li>
  )
}

export function CatalogSidebar() {
  const segmentFilter = useMissionStore((s) => s.segmentFilter)
  const searchQuery = useMissionStore((s) => s.searchQuery)
  const setSegmentFilter = useMissionStore((s) => s.setSegmentFilter)
  const setSearchQuery = useMissionStore((s) => s.setSearchQuery)
  const objects = useMissionStore(useShallow(selectFilteredObjects))

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-line bg-panel">
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">RSO Catalog</h2>
          <span className="font-mono text-[10px] text-ink-faint">
            {objects.length}/{rsoObjects.length}
          </span>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, NORAD or COSPAR"
            className="w-full rounded border border-line bg-void py-1.5 pl-8 pr-8 text-sm text-ink placeholder:text-ink-faint focus:border-protected focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <div className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label="Catalog segment">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={segmentFilter === tab.id}
              onClick={() => setSegmentFilter(tab.id)}
              className={cn(
                'rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider',
                segmentFilter === tab.id
                  ? 'bg-protected/15 text-protected'
                  : 'text-ink-muted hover:bg-panel-raised hover:text-ink',
              )}
            >
              {tab.label} <span className="text-ink-faint">{countBySegment[tab.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="flex-1 divide-y divide-line/50 overflow-y-auto">
        {objects.map((o) => (
          <CatalogRow key={o.id} object={o} />
        ))}
        {objects.length === 0 && <li className="p-6 text-center text-sm text-ink-faint">No objects match.</li>}
      </ul>
    </aside>
  )
}
