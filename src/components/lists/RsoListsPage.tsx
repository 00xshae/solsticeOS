import { useMemo, useState } from 'react'
import { ArrowDownUp, Pencil, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CATEGORY_LABEL } from '@/lib/format'
import { CategoryChip } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Modal'
import { selectOpenList, useMissionStore } from '@/store/missionStore'
import type { ListScope, RSOList, RsoListCategory } from '@/types'
import { RsoListDetail } from './RsoListDetail'

const CATEGORIES: RsoListCategory[] = ['owned', 'allied', 'opposed']
const SCOPES: ListScope[] = ['ORG', 'USER']

type SortKey = 'category' | 'name' | 'scope' | 'members'

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'category', label: 'Category', className: 'w-32' },
  { key: 'name', label: 'Name' },
  { key: 'scope', label: 'Scope', className: 'w-24' },
  { key: 'members', label: 'Members', className: 'w-24 text-right' },
]

function Segmented<T extends string>({
  value,
  options,
  label,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  label: string
  onChange: (value: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
            value === o.value ? 'bg-accent-muted text-accent' : 'text-secondary hover:bg-elevated hover:text-primary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function NewListForm({ onDone }: { onDone: () => void }) {
  const createList = useMissionStore((s) => s.createList)
  const openList = useMissionStore((s) => s.openList)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<RsoListCategory>('opposed')
  const [scope, setScope] = useState<ListScope>('USER')

  const submit = () => {
    if (!name.trim()) return
    openList(createList({ name, category, scope }))
    onDone()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-elevated/40 px-4 py-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onDone()
        }}
        placeholder="List name, e.g. Opposed inspector 2"
        aria-label="List name"
        className="min-w-64 flex-1 rounded-lg border border-border bg-base px-3 py-1.5 text-[13px] text-primary placeholder:text-tertiary focus:border-border-focus focus:outline-none"
      />
      <Segmented
        label="Category"
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />
      <Segmented label="Scope" value={scope} onChange={setScope} options={SCOPES.map((s) => ({ value: s, label: s }))} />
      <Button variant="primary" onClick={submit} disabled={!name.trim()}>
        Create
      </Button>
      <Button onClick={onDone}>Cancel</Button>
    </div>
  )
}

function ListRow({ list }: { list: RSOList }) {
  const openList = useMissionStore((s) => s.openList)
  const renameList = useMissionStore((s) => s.renameList)
  const deleteList = useMissionStore((s) => s.deleteList)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(list.name)

  return (
    <tr className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-elevated" onClick={() => !editing && openList(list.id)}>
      <td className="px-4 py-3">
        <CategoryChip category={list.category} />
      </td>
      <td className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-primary">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                renameList(list.id, draft)
                setEditing(false)
              }
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label="Rename list"
            className="w-full rounded-md border border-border-focus bg-base px-2 py-1 text-[12px] uppercase text-primary focus:outline-none"
          />
        ) : (
          list.name
        )}
      </td>
      <td className="px-4 py-3 font-mono text-[12px] text-secondary">{list.scope}</td>
      <td className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-primary">{list.memberIds.length}</td>
      <td className="px-4 py-3">
        {list.scope === 'USER' && (
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => deleteList(list.id)}
              aria-label={`Delete ${list.name}`}
              title="Delete list"
              className="rounded-md border border-border p-1.5 text-tertiary hover:border-sev-red/50 hover:text-sev-red-ink"
            >
              <X className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(list.name)
                setEditing(true)
              }}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-secondary hover:bg-elevated hover:text-primary"
            >
              <Pencil className="size-3" /> Edit
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function SavedWatchlists() {
  const lists = useMissionStore((s) => s.lists)
  const [creating, setCreating] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return lists
    const value: Record<SortKey, (l: RSOList) => string | number> = {
      category: (l) => CATEGORIES.indexOf(l.category),
      name: (l) => l.name,
      scope: (l) => l.scope,
      members: (l) => l.memberIds.length,
    }
    const get = value[sort.key]
    return [...lists].sort((a, b) => (get(a) < get(b) ? -1 : get(a) > get(b) ? 1 : 0) * sort.dir)
  }, [lists, sort])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-tertiary">Watchlist & protect-list management</div>
        <h1 className="mt-1 text-xl font-semibold text-primary">Saved Watchlists</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-secondary">
          Orbital Rakshak calculates a threat window only once an object sits in an <b className="text-owned">owned</b> or{' '}
          <b className="text-allied">allied</b> list and another sits in an <b className="text-opposed">opposed</b> list. The
          lists are the mechanism, not just labels.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-widest text-accent">RSO lists</h2>
          <Button variant="primary" onClick={() => setCreating(true)} disabled={creating}>
            <Plus className="size-3.5" /> New list
          </Button>
        </div>
        {creating && <NewListForm onDone={() => setCreating(false)} />}
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn('px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-tertiary', c.className)}>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}
                    className="inline-flex items-center gap-1 hover:text-primary"
                  >
                    {c.label}
                    <ArrowDownUp className={cn('size-3', sort?.key === c.key ? 'text-accent' : 'opacity-50')} />
                  </button>
                </th>
              ))}
              <th className="w-40 px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-tertiary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => (
              <ListRow key={l.id} list={l} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

/** Solstice-style RSO list management: the saved watchlists, or one list's members. */
export function RsoListsPage() {
  const open = useMissionStore(selectOpenList)
  return <div className="h-full overflow-y-auto bg-base">{open ? <RsoListDetail list={open} /> : <SavedWatchlists />}</div>
}
