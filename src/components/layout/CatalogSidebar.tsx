import { Check, Plus, Search, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { rsoObjects } from '@/data'
import { cn } from '@/lib/cn'
import { SEGMENT_CODE } from '@/lib/format'
import { CategoryChip, SeverityBadge } from '@/components/ui/Badge'
import { useAggregateSeverity } from '@/hooks/useSeverity'
import {
  rsoCategories,
  selectSearchResults,
  selectTrackedObjects,
  useMissionStore,
} from '@/store/missionStore'
import type { RSOObject } from '@/types'

function useRowSeverity(object: RSOObject) {
  const categories = rsoCategories(object.id)
  const role = categories.includes('owned') ? 'vulnerable' : categories.includes('opposed') ? 'endangering' : null
  return useAggregateSeverity(object.id, role)
}

function ObjectMeta({ object }: { object: RSOObject }) {
  const [category] = rsoCategories(object.id)
  return (
    <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-tertiary">
      <span>{object.noradId}</span>
      <span className="text-secondary">{SEGMENT_CODE[object.segment]}</span>
      {category && <CategoryChip category={category} className="px-1.5 py-px" />}
    </div>
  )
}

/** A catalog match: clicking adds it to the globe and flies to it. */
function SearchResultRow({ object }: { object: RSOObject }) {
  const tracked = useMissionStore((s) => s.trackedIds.includes(object.id))
  const selectRso = useMissionStore((s) => s.selectRso)

  return (
    <li>
      <button
        type="button"
        onClick={() => selectRso(object.id)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 ease-out hover:bg-elevated"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-primary">{object.name}</div>
          <ObjectMeta object={object} />
        </div>
        {tracked ? (
          <Check className="size-4 text-accent" aria-label="On globe" />
        ) : (
          <Plus className="size-4 text-tertiary" aria-label="Add to globe" />
        )}
      </button>
    </li>
  )
}

function TrackedRow({ object }: { object: RSOObject }) {
  const selected = useMissionStore((s) => s.selectedRsoId === object.id)
  const selectRso = useMissionStore((s) => s.selectRso)
  const untrackRso = useMissionStore((s) => s.untrackRso)
  const severity = useRowSeverity(object)

  return (
    <li
      className={cn(
        'group flex items-center border-l-2 transition-colors duration-150 ease-out',
        selected ? 'border-accent bg-accent-muted' : 'border-transparent hover:bg-elevated',
      )}
    >
      <button
        type="button"
        onClick={() => selectRso(selected ? null : object.id)}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-primary">{object.name}</div>
          <ObjectMeta object={object} />
        </div>
        {severity ? (
          <SeverityBadge index={severity.index} />
        ) : (
          <span className="w-7 text-center font-mono text-xs text-disabled">–</span>
        )}
      </button>
      <button
        type="button"
        onClick={() => untrackRso(object.id)}
        aria-label={`Remove ${object.name} from globe`}
        className="mx-1 rounded-md p-1.5 text-tertiary opacity-0 transition-opacity duration-150 hover:bg-elevated hover:text-primary focus:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  )
}

function SectionTitle({ children, count }: { children: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between px-3 pb-1 pt-3">
      <h3 className="text-[10px] font-medium uppercase tracking-widest text-tertiary">{children}</h3>
      <span className="font-mono text-[10px] tabular-nums text-tertiary">{count}</span>
    </div>
  )
}

export function CatalogSidebar() {
  const searchQuery = useMissionStore((s) => s.searchQuery)
  const setSearchQuery = useMissionStore((s) => s.setSearchQuery)
  const selectRso = useMissionStore((s) => s.selectRso)
  const results = useMissionStore(useShallow(selectSearchResults))
  const tracked = useMissionStore(useShallow(selectTrackedObjects))
  const searching = searchQuery.trim() !== ''

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-secondary">RSO Catalog</h2>
          <span className="text-[11px] text-tertiary">{rsoObjects.length} in catalog</span>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) selectRso(results[0].id)
              if (e.key === 'Escape') setSearchQuery('')
            }}
            placeholder="Search RSOs to add…"
            className="w-full rounded-lg border border-border bg-base py-1.5 pl-8 pr-8 text-[13px] text-primary transition-colors duration-150 placeholder:text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searching && (
          <section className="border-b border-border">
            <SectionTitle count={results.length}>Search results</SectionTitle>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {results.map((o) => (
                <SearchResultRow key={o.id} object={o} />
              ))}
              {results.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-tertiary">No objects match.</li>}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle count={tracked.length}>On globe</SectionTitle>
          <ul className="divide-y divide-border">
            {tracked.map((o) => (
              <TrackedRow key={o.id} object={o} />
            ))}
          </ul>
          {tracked.length === 0 && (
            <p className="px-6 py-8 text-center text-[13px] leading-relaxed text-tertiary">
              Nothing on the globe yet. Search the catalog above to add objects.
            </p>
          )}
        </section>
      </div>
    </aside>
  )
}
