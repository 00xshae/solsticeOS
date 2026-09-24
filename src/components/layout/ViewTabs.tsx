import { Globe2, ListChecks } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useMissionStore, type AppView } from '@/store/missionStore'

const TABS: { view: AppView; label: string; icon: typeof Globe2 }[] = [
  { view: 'globe', label: 'Globe', icon: Globe2 },
  { view: 'lists', label: 'RSO Lists', icon: ListChecks },
]

/** Top-level navigation between the operating picture and list management. */
export function ViewTabs() {
  const view = useMissionStore((s) => s.view)
  const setView = useMissionStore((s) => s.setView)
  const openList = useMissionStore((s) => s.openList)
  return (
    <nav className="flex items-center gap-1" aria-label="Views">
      {TABS.map(({ view: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          // Re-clicking RSO Lists returns from a list to the saved-watchlists table.
          onClick={() => (v === 'lists' ? openList(null) : setView(v))}
          aria-current={view === v ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors duration-100',
            view === v ? 'bg-accent-muted text-accent' : 'text-secondary hover:bg-elevated hover:text-primary',
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
