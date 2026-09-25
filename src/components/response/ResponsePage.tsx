import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { conjunctions, rsoById } from '@/data'
import { formatCountdown, formatKm, formatPc } from '@/lib/format'
import { isConjunctionOpen } from '@/lib/severity'
import { SeverityBadge } from '@/components/ui/Badge'
import { ConjunctionCard } from '@/components/inspector/ConjunctionCard'
import { ResponseOptions } from '@/components/inspector/ResponseOptions'
import { useDisplayMinute, useSeverity } from '@/hooks/useSeverity'
import { selectActiveConjunction, selectSeverity, useMissionStore } from '@/store/missionStore'
import type { ConjunctionEvent } from '@/types'

const actionable = conjunctions.filter((e) => e.sequenceIds.length > 0)

function QueueRow({ event }: { event: ConjunctionEvent }) {
  const severity = useSeverity(event)
  const minute = useDisplayMinute()
  const selectConjunction = useMissionStore((s) => s.selectConjunction)
  const primary = rsoById.get(event.primaryId)
  const secondary = rsoById.get(event.secondaryId)

  return (
    <tr
      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-elevated"
      onClick={() => selectConjunction(event.id)}
    >
      <td className="px-4 py-3">
        <SeverityBadge index={severity.index} muted={!isConjunctionOpen(event, minute * 60_000)} />
      </td>
      <td className="px-4 py-3">
        <div className="text-[12px] font-medium text-owned">{primary?.name}</div>
        <div className="text-[12px] font-medium text-opposed">{secondary?.name}</div>
      </td>
      <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-primary">
        {formatCountdown(Date.parse(event.tca), minute * 60_000)}
      </td>
      <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-secondary">{formatKm(event.missDistanceM)}</td>
      <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-secondary">Pc {formatPc(event.pc)}</td>
      <td className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-primary">{event.sequenceIds.length}</td>
    </tr>
  )
}

function ResponseQueue() {
  const minute = useDisplayMinute()
  const radius = useMissionStore((s) => s.screeningRadiusOverrideKm)
  const sorted = useMemo(() => {
    const s = useMissionStore.getState()
    return [...actionable].sort((a, b) => selectSeverity(s, b).index - selectSeverity(s, a).index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, radius])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-tertiary">Respond</div>
        <h1 className="mt-1 font-display text-xl font-semibold text-primary">Response Queue</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-secondary">
          Conjunctions with a feasible course of action. Orbital Rakshak compares options and drafts the manoeuvre
          plan — the operator selects and commits it.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="w-16 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-tertiary">CSI</th>
              <th className="px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-tertiary">Pair</th>
              <th className="w-28 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-tertiary">Time to TCA</th>
              <th className="w-24 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-tertiary">Miss</th>
              <th className="w-24 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-tertiary">Pc</th>
              <th className="w-20 px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-tertiary">
                COAs
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <QueueRow key={e.id} event={e} />
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="px-4 py-6 text-[12px] text-tertiary">No conjunctions currently have a feasible course of action.</p>
        )}
      </section>
    </div>
  )
}

function ResponseDetail({ event }: { event: ConjunctionEvent }) {
  const selectConjunction = useMissionStore((s) => s.selectConjunction)
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-6">
      <button
        type="button"
        onClick={() => selectConjunction(null)}
        className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-secondary transition-colors duration-100 hover:text-primary"
      >
        <ArrowLeft className="size-3.5" /> Response queue
      </button>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <ConjunctionCard event={event} />
        <ResponseOptions event={event} />
      </div>
    </div>
  )
}

/** Respond: the queue of conjunctions with a feasible course of action, or one's COA/commit/filing detail. */
export function ResponsePage() {
  const active = useMissionStore(selectActiveConjunction)
  return (
    <div className="h-full overflow-y-auto bg-base">
      {active && active.sequenceIds.length > 0 ? <ResponseDetail event={active} /> : <ResponseQueue />}
    </div>
  )
}
