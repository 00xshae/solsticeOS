import { Globe2, ListChecks, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useMissionStore, type AppView } from '@/store/missionStore'

const TABS: { view: AppView; label: string; icon: typeof Globe2 }[] = [
  { view: 'globe', label: 'Globe', icon: Globe2 },
  { view: 'lists', label: 'RSO Lists', icon: ListChecks },
  { view: 'response', label: 'Response', icon: ShieldAlert },
]

/** Top-level navigation between the operating picture, list management and the response queue. */
export function ViewTabs() {
  const view = useMissionStore((s) => s.view)
  const setView = useMissionStore((s) => s.setView)
  const openList = useMissionStore((s) => s.openList)
  const selectConjunction = useMissionStore((s) => s.selectConjunction)
  return (
    <nav className="flex items-center gap-1" aria-label="Views">
      {TABS.map(({ view: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => {
            // Re-clicking RSO Lists or Response returns to their top-level table.
            if (v === 'lists') return openList(null)
            if (v === 'response') {
              selectConjunction(null)
              setView(v)
              return
            }
            setView(v)
          }}
          aria-current={view === v ? 'page' : undefined}
          className={cn(
            'group relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-display text-[13px] font-semibold uppercase tracking-wider transition-colors duration-100',
            view === v ? 'text-accent' : 'text-secondary hover:text-primary',
          )}
        >
          <Icon className="size-3.5" />
          {label}
          {/* Targeting-readout underline rather than a filled pill — reads active from across the room. */}
          <span
            className={cn(
              'glow absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent transition-all duration-200 ease-out [--glow:var(--color-accent)]',
              view === v ? 'opacity-100' : 'opacity-0 group-hover:opacity-30',
            )}
            aria-hidden
          />
        </button>
      ))}
    </nav>
  )
}
