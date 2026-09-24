import { useState } from 'react'
import { ArrowRight, ChevronDown, Globe2 } from 'lucide-react'
import { rsoById, threatWindowById } from '@/data'
import { cn } from '@/lib/cn'
import { formatAgo, formatUtc } from '@/lib/format'
import { describeThreatConfig } from '@/lib/threat'
import { SeverityBadge } from '@/components/ui/Badge'
import { useMissionStore } from '@/store/missionStore'
import type { ThreatLogEntry, ThreatLogReason } from '@/types'
import { SectionLabel, ThreatScale } from './ThreatBreakdown'

const REASON_LABEL: Record<ThreatLogReason, string> = {
  MEMBER_ADDED: 'Member added',
  MEMBER_REMOVED: 'Member removed',
  REASSESSED: 'Reassessed',
}

/** Most entries a demo needs on screen; older ones stay in the store. */
const VISIBLE_ENTRIES = 60

function Rating({ value }: { value: number | null }) {
  return value === null ? (
    <span className="inline-grid h-6 min-w-7 place-items-center font-mono text-xs text-tertiary">—</span>
  ) : (
    <SeverityBadge index={value} />
  )
}

function summary(entry: ThreatLogEntry, name: string) {
  if (entry.previous === null) return `First recorded rating for ${name}: ${entry.rating} of 100.`
  if (entry.rating === null) return `${name} is no longer rated: no screened window remains.`
  if (entry.rating === entry.previous) return `${name} held at ${entry.rating} of 100.`
  const verb = entry.rating > entry.previous ? 'rose' : 'fell'
  return `Rating for ${name} ${verb} from ${entry.previous} to ${entry.rating} of 100.`
}

function LogRow({ entry }: { entry: ThreatLogEntry }) {
  const [open, setOpen] = useState(false)
  const nowMinute = useMissionStore((s) => Math.floor(s.simTimeMs / 60_000))
  const selectRso = useMissionStore((s) => s.selectRso)
  const setView = useMissionStore((s) => s.setView)
  const object = rsoById.get(entry.objectId)
  const name = object?.name ?? entry.objectId
  const recordedMs = Date.parse(entry.recordedAt)
  const counterpart = entry.role === 'threatened' ? 'opposedId' : 'targetId'

  return (
    <li className={cn(open && 'bg-elevated/50')}>
      <div className="flex items-center gap-1.5 py-2 pl-3 pr-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 gap-2 text-left">
          <div className="w-[66px] shrink-0 font-mono text-[10px] leading-4 tabular-nums">
            <div className="text-primary">{formatUtc(recordedMs, false).slice(5)}</div>
            <div className="uppercase text-tertiary">{formatAgo(recordedMs, nowMinute * 60_000)}</div>
          </div>
          <div className="min-w-0" title={name}>
            <div className="truncate text-[12px] font-medium text-primary">{name}</div>
            <div className="truncate text-[10px] text-tertiary">
              <span className="font-medium uppercase tracking-wider">{entry.role}</span> · {REASON_LABEL[entry.reason].toLowerCase()}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setView('globe')
            selectRso(entry.objectId)
          }}
          title="Show on globe"
          aria-label={`Show ${name} on globe`}
          className="rounded-md p-1 text-tertiary hover:bg-elevated hover:text-primary"
        >
          <Globe2 className="size-3.5" />
        </button>
        <div className="flex items-center gap-0.5">
          <Rating value={entry.previous} />
          <ArrowRight className="size-3 text-tertiary" />
          <Rating value={entry.rating} />
        </div>
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'} className="text-tertiary hover:text-primary">
          <ChevronDown className={cn('size-3.5 transition-transform', !open && 'rotate-90')} />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <p className="text-[12px] text-primary">{summary(entry, name)}</p>
          <div>
            <SectionLabel>Recorded at assessment time</SectionLabel>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[10px] text-secondary">
              <dt className="text-tertiary">Rating config</dt>
              <dd>{describeThreatConfig(entry.config)}</dd>
              <dt className="text-tertiary">Assessment time</dt>
              <dd>{formatUtc(recordedMs)} UTC</dd>
            </dl>
          </div>
          {entry.contributors.length > 0 && (
            <div>
              <SectionLabel>Contributing threats · worst first</SectionLabel>
              <ul className="space-y-1">
                {entry.contributors.map((c) => {
                  const window = threatWindowById.get(c.windowId)
                  return (
                    <li key={c.windowId} className="flex items-center gap-2 font-mono text-[11px] text-primary">
                      <SeverityBadge index={c.rating} />
                      {window ? rsoById.get(window[counterpart])?.name : c.windowId}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <ThreatScale />
        </div>
      )}
    </li>
  )
}

/** Recorded ratings, newest first: the living score behind each threatened or threatening RSO. */
export function ThreatLog({ objectId }: { objectId?: string }) {
  const log = useMissionStore((s) => s.threatLog)
  const entries = (objectId ? log.filter((e) => e.objectId === objectId) : log).slice(0, VISIBLE_ENTRIES)
  if (entries.length === 0) {
    return <p className="px-3 py-3 text-[12px] text-tertiary">No recorded ratings yet.</p>
  }
  return (
    <ul className="max-h-80 divide-y divide-border overflow-y-auto">
      {entries.map((e) => (
        <LogRow key={e.id} entry={e} />
      ))}
    </ul>
  )
}
