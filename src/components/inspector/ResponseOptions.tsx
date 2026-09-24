import { useMemo, useState } from 'react'
import { CheckCircle2, FileText, Rocket, TriangleAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { rsoById, sequenceById } from '@/data'
import { cn } from '@/lib/cn'
import { coaMetrics, recommendCoa, type CoaMetrics } from '@/lib/cola'
import { formatKm, formatPc, formatUtc } from '@/lib/format'
import { SeverityBadge } from '@/components/ui/Badge'
import { Button, Modal } from '@/components/ui/Modal'
import { Section } from '@/components/ui/Section'
import { selectEffectiveEnvelope, selectScreeningRadiusKm, useMissionStore } from '@/store/missionStore'
import type { ConjunctionEvent } from '@/types'

const hoursMinutes = (ms: number) => {
  const min = Math.max(0, Math.floor(ms / 60_000))
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
}

/** COA metrics at the mission clock (not the scrubber): decisions happen in real time. */
function useCoaMetrics(event: ConjunctionEvent) {
  const minute = useMissionStore((s) => Math.floor(s.simTimeMs / 60_000))
  const envelope = useMissionStore(useShallow((s) => selectEffectiveEnvelope(s, event.primaryId)))
  const radiusKm = useMissionStore((s) => selectScreeningRadiusKm(s, event))
  return useMemo(() => {
    const metrics = event.sequenceIds.map((id) =>
      coaMetrics(sequenceById.get(id)!, event, envelope, minute * 60_000, radiusKm),
    )
    return { metrics, recommended: recommendCoa(metrics) }
  }, [event, envelope, minute, radiusKm])
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-medium uppercase tracking-widest text-tertiary">{label}</div>
      <div className={cn('truncate font-mono text-[12px] font-medium tabular-nums text-primary', tone)}>{value}</div>
    </div>
  )
}

function CoaCard({ m, selected, recommended }: { m: CoaMetrics; selected: boolean; recommended: boolean }) {
  const selectSequence = useMissionStore((s) => s.selectSequence)
  const sequence = sequenceById.get(m.sequenceId)!
  return (
    <button
      type="button"
      onClick={() => selectSequence(m.sequenceId)}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-xl border p-3 text-left transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        selected ? 'border-accent/40 bg-accent-muted' : 'border-border hover:border-border-strong',
        !m.feasible && 'opacity-70',
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className={cn('text-[13px] font-semibold', selected ? 'text-accent' : 'text-primary')}>{sequence.name}</span>
        {recommended && (
          <span className="rounded-full bg-sev-green/10 px-2 py-0.5 text-[9px] font-medium uppercase leading-none tracking-wider text-sev-green-ink">
            Recommended
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest text-tertiary">
          Post CSI <SeverityBadge index={m.postIndex} />
        </span>
      </div>
      <p className="mb-2.5 text-[11px] leading-snug text-secondary">{sequence.summary}</p>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
        <Metric label="Total Δv" value={`${m.totalDeltaVMps.toFixed(2)} m/s`} />
        <Metric
          label="Of budget"
          value={Number.isFinite(m.budgetShare) ? `${(m.budgetShare * 100).toFixed(1)}%` : '—'}
          tone={m.budgetShare > 1 ? 'text-sev-orange-ink' : undefined}
        />
        <Metric label="Burn each" value={Number.isFinite(m.burnDurationS) ? `${m.burnDurationS.toFixed(0)} s` : '—'} />
        <Metric label="Decide within" value={hoursMinutes(m.decisionLeadMs)} />
        <Metric label="Post miss" value={formatKm(m.postMissDistanceM)} tone="text-sev-green-ink" />
        <Metric label="Post Pc" value={formatPc(m.postPc)} tone="text-sev-green-ink" />
      </div>
      {m.blocker && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-sev-orange-ink">
          <TriangleAlert className="size-3" /> {m.blocker}
        </p>
      )}
    </button>
  )
}

function ExecuteDialog({ event, m, onClose }: { event: ConjunctionEvent; m: CoaMetrics; onClose: () => void }) {
  const commitCola = useMissionStore((s) => s.commitCola)
  const sequence = sequenceById.get(m.sequenceId)!
  const primary = rsoById.get(event.primaryId)
  const [, b1, , b2] = sequence.steps
  return (
    <Modal
      title="Execute COLA burn plan"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              commitCola()
              onClose()
            }}
          >
            <Rocket className="size-3.5" /> Commit plan
          </Button>
        </>
      }
    >
      <div className="space-y-3 px-4 py-4 text-[13px] leading-relaxed text-secondary">
        <p>
          Commit <span className="font-medium text-primary">{sequence.name}</span> for <span className="font-medium text-protected">{primary?.name}</span>.
          The plan is queued for upload and locked until you pick another course of action.
        </p>
        <ul className="space-y-1 rounded-lg border border-border bg-base p-3 font-mono text-[11px] tabular-nums text-primary">
          <li>Burn 1 · {formatUtc(Date.parse(b1.start))} UTC · +{b1.deltaVMps.toFixed(2)} m/s in-track</li>
          <li>Burn 2 · {formatUtc(Date.parse(b2.start))} UTC · −{b2.deltaVMps.toFixed(2)} m/s in-track</li>
          <li>
            Predicted at TCA · {formatKm(m.postMissDistanceM)} miss · Pc {formatPc(m.postPc)}
          </li>
        </ul>
        <p className="text-[10px] font-medium uppercase tracking-wider text-tertiary">
          Demo only: no command is sent to any spacecraft.
        </p>
      </div>
    </Modal>
  )
}

/** Respond: compare courses of action, commit one, then file the compliance export. */
export function ResponseOptions({ event }: { event: ConjunctionEvent }) {
  const { metrics, recommended } = useCoaMetrics(event)
  const activeSequenceId = useMissionStore((s) => s.activeSequenceId)
  const colaStatus = useMissionStore((s) => s.colaStatus)
  const committedAtMs = useMissionStore((s) => s.committedAtMs)
  const setComplianceOpen = useMissionStore((s) => s.setComplianceOpen)
  const [confirming, setConfirming] = useState(false)
  const active = metrics.find((m) => m.sequenceId === activeSequenceId)

  if (metrics.length === 0) return null

  return (
    <Section title={`Response options · ${metrics.length} COA`}>
      <div className="space-y-2 px-3 py-3">
        {metrics.map((m) => (
          <CoaCard key={m.sequenceId} m={m} selected={m.sequenceId === activeSequenceId} recommended={m.sequenceId === recommended} />
        ))}
        {!recommended && (
          <p className="text-[10px] font-medium uppercase tracking-wider text-sev-orange-ink">
            No plan fits the current envelope and timeline.
          </p>
        )}

        {colaStatus === 'COMMITTED' && active ? (
          <div className="space-y-2.5 rounded-xl border border-sev-green/30 bg-sev-green/[0.06] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-sev-green-ink">
              <CheckCircle2 className="size-3.5" /> Plan committed{' '}
              {committedAtMs && <span className="font-mono tabular-nums">· {formatUtc(committedAtMs)} UTC</span>}
            </p>
            <Button variant="primary" onClick={() => setComplianceOpen(true)}>
              <FileText className="size-3.5" /> Generate IN-SPACe NGP filing
            </Button>
          </div>
        ) : (
          <Button variant="danger" disabled={!active?.feasible} onClick={() => setConfirming(true)}>
            <Rocket className="size-3.5" /> Execute COLA burn plan
          </Button>
        )}
      </div>
      {confirming && active && <ExecuteDialog event={event} m={active} onClose={() => setConfirming(false)} />}
    </Section>
  )
}
