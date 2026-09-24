import { useMemo, useState } from 'react'
import { ChevronRight, Globe2, Plus, Search, X } from 'lucide-react'
import { rsoById, rsoObjects } from '@/data'
import { OBJECT_TYPE } from '@/lib/format'
import { CategoryChip, SeverityBadge } from '@/components/ui/Badge'
import { useObjectThreat } from '@/hooks/useThreat'
import { useMissionStore } from '@/store/missionStore'
import type { ListScope, RSOList, RSOObject, ThreatRole } from '@/types'

const HEADERS = ['Name', 'Threat', 'Semi major axis', 'Eccentricity', 'Inclination', 'RAAN', 'Argument of perigee', 'TLE age/days', '']

function ThreatCell({ objectId, role, scope }: { objectId: string; role: ThreatRole; scope: ListScope }) {
  const threat = useObjectThreat(objectId, role, scope)
  const openRatingModal = useMissionStore((s) => s.openRatingModal)
  return (
    <button
      type="button"
      onClick={() => openRatingModal({ kind: 'object', objectId, role })}
      title={`${scope} ${role} rating: explain`}
      className="flex w-9 flex-col items-center gap-0.5 rounded-md py-0.5 hover:bg-elevated"
    >
      {threat ? (
        <SeverityBadge index={threat.rating} />
      ) : (
        <span className="grid h-6 place-items-center font-mono text-xs text-tertiary">—</span>
      )}
      <span className="text-[9px] font-medium uppercase tracking-wider text-tertiary">{scope}</span>
    </button>
  )
}

function MemberRow({ list, object }: { list: RSOList; object: RSOObject }) {
  const removeListMember = useMissionStore((s) => s.removeListMember)
  const selectRso = useMissionStore((s) => s.selectRso)
  const setView = useMissionStore((s) => s.setView)
  const role: ThreatRole = list.category === 'opposed' ? 'threatening' : 'threatened'
  const el = object.elements
  const num = 'px-4 py-3 text-right font-mono text-[12px] tabular-nums text-primary'

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-elevated/50">
      <td className="px-4 py-3">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-primary">{object.name}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-tertiary">
          {object.noradId} · {OBJECT_TYPE[object.segment]}
        </div>
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <ThreatCell objectId={object.id} role={role} scope="ORG" />
          <ThreatCell objectId={object.id} role={role} scope="USER" />
        </div>
      </td>
      <td className={num}>{el.smaKm.toFixed(1)} km</td>
      <td className={num}>{el.ecc.toFixed(6)}</td>
      <td className={num}>{el.incDeg.toFixed(2)}°</td>
      <td className={num}>{el.raanDeg.toFixed(2)}°</td>
      <td className={num}>{el.argpDeg.toFixed(2)}°</td>
      <td className={num}>{(object.tleAgeHours / 24).toFixed(1)}</td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              selectRso(object.id)
              setView('globe')
            }}
            title="Show on globe"
            aria-label={`Show ${object.name} on globe`}
            className="rounded-md p-1.5 text-tertiary hover:bg-elevated hover:text-primary"
          >
            <Globe2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => removeListMember(list.id, object.id)}
            title="Remove from list"
            aria-label={`Remove ${object.name} from ${list.name}`}
            className="rounded-md p-1.5 text-tertiary hover:bg-elevated hover:text-sev-red-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddMember({ list }: { list: RSOList }) {
  const addListMember = useMissionStore((s) => s.addListMember)
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return rsoObjects
      .filter((o) => !list.memberIds.includes(o.id))
      .filter((o) => o.name.toLowerCase().includes(q) || String(o.noradId).includes(q) || o.cosparId.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, list.memberIds])

  const add = (id: string) => {
    addListMember(list.id, id)
    setQuery('')
  }

  return (
    <div className="relative w-80">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-tertiary" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) add(matches[0].id)
          if (e.key === 'Escape') setQuery('')
        }}
        placeholder="Add RSO by name, NORAD or COSPAR…"
        aria-label="Add RSO to list"
        className="w-full rounded-lg border border-border bg-base py-1.5 pl-8 pr-3 text-[13px] text-primary placeholder:text-tertiary focus:border-border-focus focus:outline-none"
      />
      {matches.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-glass-border bg-overlay shadow-2xl">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => add(o.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-elevated"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-primary">{o.name}</span>
                  <span className="font-mono text-[10px] text-tertiary">
                    {o.noradId} · {OBJECT_TYPE[o.segment]}
                  </span>
                </span>
                <Plus className="size-3.5 text-tertiary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One list: its members with ORG / USER threat ratings and orbital elements. */
export function RsoListDetail({ list }: { list: RSOList }) {
  const openList = useMissionStore((s) => s.openList)
  const members = list.memberIds.flatMap((id) => rsoById.get(id) ?? [])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-6">
      <nav className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em]" aria-label="Breadcrumb">
        <button type="button" onClick={() => openList(null)} className="text-tertiary hover:text-primary">
          RSO lists
        </button>
        <ChevronRight className="size-3.5 text-tertiary" />
        <span className="text-primary">{list.name}</span>
      </nav>

      <section className="rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <h1 className="font-display text-[15px] font-semibold uppercase tracking-[0.12em] text-primary">{list.name}</h1>
          <CategoryChip category={list.category} />
          <span className="font-mono text-[11px] text-tertiary">
            {list.scope} · {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
          <div className="ml-auto">
            <AddMember list={list} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {HEADERS.map((h, i) => (
                  <th
                    key={h || 'actions'}
                    className={`px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-tertiary ${i < 2 ? 'text-left' : 'text-right'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((o) => (
                <MemberRow key={o.id} list={list} object={o} />
              ))}
            </tbody>
          </table>
          {members.length === 0 && (
            <p className="px-4 py-10 text-center text-[13px] text-tertiary">
              No members yet. Add an RSO above: an opposed member creates threat windows against owned and allied objects.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
