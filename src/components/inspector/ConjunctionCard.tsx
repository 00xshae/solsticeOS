import { useMemo } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { rsoById } from '@/data'
import { cn } from '@/lib/cn'
import { formatCountdown, formatKm, formatPc, formatUtc, SEVERITY_HEX } from '@/lib/format'
import {
  computeSeverity,
  DEFAULT_SEVERITY_CONFIG,
  describeSeverity,
  SEVERITY_FACTORS,
} from '@/lib/severity'
import { CategoryChip, SeverityBadge } from '@/components/ui/Badge'
import { Field, Section } from '@/components/ui/Section'
import { useDisplayMinute, useSeverity } from '@/hooks/useSeverity'
import { selectScreeningRadiusKm, useMissionStore } from '@/store/missionStore'
import type { ConjunctionEvent, SeverityBand, SeverityBreakdown, SeverityFactor } from '@/types'

const FACTOR_LABEL: Record<SeverityFactor, string> = {
  probability: 'Probability (Pc)',
  proximity: 'Proximity (miss)',
  imminence: 'Imminence (TCA)',
}

// Three steps of the band colour, lightest for the least weighted factor.
const FACTOR_OPACITY: Record<SeverityFactor, number> = { proximity: 0.45, probability: 0.75, imminence: 1 }

const BANDS: SeverityBand[] = ['green', 'blue', 'yellow', 'orange', 'red']

function SeverityBreakdownView({ breakdown }: { breakdown: SeverityBreakdown }) {
  const color = SEVERITY_HEX[breakdown.band]
  const { weights } = DEFAULT_SEVERITY_CONFIG
  return (
    <div className="space-y-3 px-3 py-3">
      <p className="text-[12px] leading-relaxed text-ink-muted">{describeSeverity(breakdown)}</p>
      <div>
        <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-ink-faint">Composition</div>
        <div className="font-mono text-[11px] text-ink-muted">
          weighted mean — Pc ×{weights.probability}, miss ×{weights.proximity}, TCA ×{weights.imminence}
        </div>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
          Contributions (sum to {Math.round(breakdown.index)})
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-sm bg-void" role="img" aria-label="Severity contributions">
          {SEVERITY_FACTORS.map((f) => (
            <div
              key={f}
              style={{ width: `${breakdown.terms[f].contribution}%`, backgroundColor: color, opacity: FACTOR_OPACITY[f] }}
            />
          ))}
        </div>
        <ul className="mt-2 space-y-1">
          {SEVERITY_FACTORS.map((f) => (
            <li key={f} className="flex items-center gap-2 font-mono text-[11px]">
              <span className="size-2 rounded-full" style={{ backgroundColor: color, opacity: FACTOR_OPACITY[f] }} />
              <span className={cn('flex-1 uppercase tracking-wider', f === breakdown.strongest ? 'text-ink' : 'text-ink-muted')}>
                {FACTOR_LABEL[f]}
              </span>
              <span className="text-ink-faint">{breakdown.terms[f].score.toFixed(0)}</span>
              <span className="w-8 text-right tabular-nums text-ink">+{Math.round(breakdown.terms[f].contribution)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
        Scale 0–100
        {BANDS.map((b) => (
          <span key={b} className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: SEVERITY_HEX[b] }} />
            {b}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Index at each recorded screening, evaluated at its own assessment time. */
function AssessmentHistory({ event }: { event: ConjunctionEvent }) {
  const radiusKm = useMissionStore((s) => selectScreeningRadiusKm(s, event))
  const rows = useMemo(
    () =>
      event.assessments.map((a, i) => ({
        ...a,
        index: computeSeverity({ ...a, screeningRadiusKm: radiusKm }, Date.parse(a.assessedAt)).index,
        latest: i === event.assessments.length - 1,
      })),
    [event, radiusKm],
  )
  return (
    <ol className="divide-y divide-line/50">
      {[...rows].reverse().map((row, i, list) => {
        const previous = list[i + 1]
        return (
          <li key={row.assessedAt} className="flex items-center gap-3 px-3 py-2 font-mono text-[11px]">
            <div className="flex-1">
              <div className="text-ink">{formatUtc(Date.parse(row.assessedAt), false)}</div>
              <div className="text-ink-faint">
                {formatKm(row.missDistanceM)} · Pc {formatPc(row.pc)}
              </div>
            </div>
            <span className="text-ink-faint">{previous ? Math.round(previous.index) : '—'}</span>
            <ArrowRight className="size-3 text-ink-faint" />
            <SeverityBadge index={row.index} />
            {row.latest && <span className="text-[9px] uppercase tracking-widest text-protected">Now</span>}
          </li>
        )
      })}
    </ol>
  )
}

export function ConjunctionCard({ event }: { event: ConjunctionEvent }) {
  const breakdown = useSeverity(event)
  const minute = useDisplayMinute()
  const selectConjunction = useMissionStore((s) => s.selectConjunction)
  const screeningKm = useMissionStore((s) => selectScreeningRadiusKm(s, event))
  const primary = rsoById.get(event.primaryId)
  const secondary = rsoById.get(event.secondaryId)
  const color = SEVERITY_HEX[breakdown.band]
  const tcaMs = Date.parse(event.tca)

  return (
    <div className="border-b border-line" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
      <div className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: `${color}14` }}>
        <SeverityBadge index={breakdown.index} size="lg" />
        <div className="flex-1">
          <div className="font-mono text-lg font-semibold tabular-nums" style={{ color }}>
            {Math.round(breakdown.index)}/100
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">Conjunction Severity Index</div>
        </div>
        <button
          type="button"
          onClick={() => selectConjunction(null)}
          aria-label="Close conjunction"
          className="self-start text-ink-faint hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-line px-3 py-3">
        <div className="min-w-0">
          <CategoryChip category="protected" />
          <div className="mt-1 truncate text-[13px] text-ink">{primary?.name}</div>
          <div className="font-mono text-[10px] text-ink-faint">{primary?.noradId} · PRIMARY</div>
        </div>
        <div className="min-w-0 text-right">
          <CategoryChip category="uncooperative" />
          <div className="mt-1 truncate text-[13px] text-ink">{secondary?.name}</div>
          <div className="font-mono text-[10px] text-ink-faint">{secondary?.noradId} · SECONDARY</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-line px-3 py-3">
        <Field label="TCA (UTC)" value={formatUtc(tcaMs, false).slice(5)} />
        <Field label="Time to TCA" value={formatCountdown(tcaMs, minute * 60_000)} />
        <Field label="Rel. velocity" value={`${event.relativeVelocityKmS.toFixed(2)} km/s`} />
        <Field label="Miss distance" value={formatKm(event.missDistanceM)} />
        <Field label="Pc" value={formatPc(event.pc)} />
        <Field label="Screening" value={`${screeningKm} km`} />
      </div>

      <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-x-3 gap-y-1 border-t border-line px-3 py-3 font-mono text-[11px] tabular-nums">
        <span className="text-[9px] uppercase tracking-widest text-ink-faint">RIC (m)</span>
        {['Radial', 'In-track', 'Cross'].map((h) => (
          <span key={h} className="text-right text-[9px] uppercase tracking-widest text-ink-faint">
            {h}
          </span>
        ))}
        <span className="text-ink-muted">Miss</span>
        <span className="text-right text-ink">{event.missVector.radialM}</span>
        <span className="text-right text-ink">{event.missVector.inTrackM}</span>
        <span className="text-right text-ink">{event.missVector.crossTrackM}</span>
        <span className="text-ink-muted">1σ</span>
        <span className="text-right text-ink">{event.covariance.radialM}</span>
        <span className="text-right text-ink">{event.covariance.inTrackM}</span>
        <span className="text-right text-ink">{event.covariance.crossTrackM}</span>
      </div>

      <p className="border-t border-line px-3 py-2 font-mono text-[11px] text-ink-muted">
        {event.reasoning ?? 'NO RECORDED REASONING FOR THIS WINDOW.'}
      </p>

      <Section title="Severity breakdown">
        <SeverityBreakdownView breakdown={breakdown} />
      </Section>
      <Section title={`Screening history · ${event.assessments.length}`} defaultOpen={false}>
        <AssessmentHistory event={event} />
      </Section>
    </div>
  )
}
