import { useMemo } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { rsoById } from '@/data'
import { cn } from '@/lib/cn'
import { formatCountdown, formatKm, formatPc, formatUtc, SEVERITY_HEX } from '@/lib/format'
import {
  computeSeverity,
  DEFAULT_SEVERITY_CONFIG,
  describeSeverity,
  isConjunctionOpen,
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

// Band hue tuned for text on the current surface (darker in light mode).
const BAND_INK: Record<SeverityBand, string> = {
  green: 'text-sev-green-ink',
  blue: 'text-sev-blue-ink',
  yellow: 'text-sev-yellow-ink',
  orange: 'text-sev-orange-ink',
  red: 'text-sev-red-ink',
}

const microLabel = 'text-[9px] font-medium uppercase tracking-widest text-tertiary'

function SeverityBreakdownView({ breakdown }: { breakdown: SeverityBreakdown }) {
  const color = SEVERITY_HEX[breakdown.band]
  const { weights } = DEFAULT_SEVERITY_CONFIG
  return (
    <div className="space-y-3.5 px-3 py-3">
      <p className="text-[12px] leading-relaxed text-secondary">{describeSeverity(breakdown)}</p>
      <div>
        <div className={cn(microLabel, 'mb-1')}>Composition</div>
        <div className="font-mono text-[11px] text-secondary">
          weighted mean — Pc ×{weights.probability}, miss ×{weights.proximity}, TCA ×{weights.imminence}
        </div>
      </div>
      <div>
        <div className={cn(microLabel, 'mb-1.5')}>
          Contributions (sum to <span className="font-mono tabular-nums">{Math.round(breakdown.index)}</span>)
        </div>
        <div className="flex h-2 gap-[1px] overflow-hidden rounded-full bg-base" role="img" aria-label="Severity contributions">
          {SEVERITY_FACTORS.map((f) => (
            <div
              key={f}
              className="rounded-full"
              style={{ width: `${breakdown.terms[f].contribution}%`, backgroundColor: color, opacity: FACTOR_OPACITY[f] }}
            />
          ))}
        </div>
        <ul className="mt-2.5 space-y-1">
          {SEVERITY_FACTORS.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[11px]">
              <span className="size-2 rounded-full" style={{ backgroundColor: color, opacity: FACTOR_OPACITY[f] }} />
              <span className={cn('flex-1 font-medium', f === breakdown.strongest ? 'text-primary' : 'text-secondary')}>
                {FACTOR_LABEL[f]}
              </span>
              <span className="font-mono tabular-nums text-tertiary">{breakdown.terms[f].score.toFixed(0)}</span>
              <span className="w-8 text-right font-mono font-medium tabular-nums text-primary">
                +{Math.round(breakdown.terms[f].contribution)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2.5 text-[9px] text-tertiary">
        Scale <span className="font-mono">0–100</span>
        {BANDS.map((b) => (
          <span key={b} className="flex items-center gap-1 capitalize">
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
    <ol className="divide-y divide-border-subtle">
      {[...rows].reverse().map((row, i, list) => {
        const previous = list[i + 1]
        return (
          <li key={row.assessedAt} className="flex items-center gap-3 px-3 py-2 font-mono text-[11px] tabular-nums">
            <div className="flex-1">
              <div className="font-medium text-primary">{formatUtc(Date.parse(row.assessedAt), false)}</div>
              <div className="text-tertiary">
                {formatKm(row.missDistanceM)} · Pc {formatPc(row.pc)}
              </div>
            </div>
            <span className="text-tertiary">{previous ? Math.round(previous.index) : '—'}</span>
            <ArrowRight className="size-3 text-tertiary" />
            <SeverityBadge index={row.index} />
            {row.latest && (
              <span className="font-sans text-[9px] font-semibold uppercase tracking-widest text-accent">Now</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function ConjunctionCard({ event }: { event: ConjunctionEvent }) {
  const breakdown = useSeverity(event)
  const minute = useDisplayMinute()
  const closed = !isConjunctionOpen(event, minute * 60_000)
  const selectConjunction = useMissionStore((s) => s.selectConjunction)
  const screeningKm = useMissionStore((s) => selectScreeningRadiusKm(s, event))
  const primary = rsoById.get(event.primaryId)
  const secondary = rsoById.get(event.secondaryId)
  const color = SEVERITY_HEX[breakdown.band]
  const tcaMs = Date.parse(event.tca)

  return (
    <div className="border-b border-b-border">
      <div
        className="flex items-center gap-3 px-3 py-3"
        style={{
          backgroundImage: `linear-gradient(to right, ${color}0f, transparent)`,
          boxShadow: `inset 0 0 20px -8px ${color}26`,
        }}
      >
        <SeverityBadge index={breakdown.index} size="lg" muted={closed} />
        <div className="flex-1">
          <div className={cn('font-mono text-xl font-bold tabular-nums', BAND_INK[breakdown.band])}>
            {Math.round(breakdown.index)}
            <span className="text-sm font-medium opacity-60">/100</span>
          </div>
          <div className="text-[11px] text-tertiary">
            {closed ? 'Window closed · pair has cleared TCA' : 'Conjunction Severity Index'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => selectConjunction(null)}
          aria-label="Close conjunction"
          className="self-start rounded-md p-1 text-tertiary transition-colors duration-100 hover:bg-elevated hover:text-primary"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border-subtle px-3 py-3">
        <div className="min-w-0">
          <CategoryChip category="owned" />
          <div className="mt-1.5 truncate text-[13px] font-medium text-primary">{primary?.name}</div>
          <div className="text-[10px] text-tertiary">
            <span className="font-mono tabular-nums">{primary?.noradId}</span> · Primary
          </div>
        </div>
        <div className="min-w-0 text-right">
          <CategoryChip category="opposed" />
          <div className="mt-1.5 truncate text-[13px] font-medium text-primary">{secondary?.name}</div>
          <div className="text-[10px] text-tertiary">
            <span className="font-mono tabular-nums">{secondary?.noradId}</span> · Secondary
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border-subtle px-3 py-3">
        <Field label="TCA (UTC)" value={formatUtc(tcaMs, false).slice(5)} />
        <Field label="Time to TCA" value={formatCountdown(tcaMs, minute * 60_000)} />
        <Field label="Rel. velocity" value={`${event.relativeVelocityKmS.toFixed(2)} km/s`} />
        <Field label="Miss distance" value={formatKm(event.missDistanceM)} />
        <Field label="Pc" value={formatPc(event.pc)} />
        <Field label="Screening" value={`${screeningKm} km`} />
      </div>

      <div className="grid grid-cols-[auto_repeat(3,1fr)] items-baseline gap-x-3 gap-y-1 border-t border-border-subtle px-3 py-3 text-[11px]">
        <span className={microLabel}>RIC (m)</span>
        {['Radial', 'In-track', 'Cross'].map((h) => (
          <span key={h} className={cn(microLabel, 'text-right')}>
            {h}
          </span>
        ))}
        <span className="text-secondary">Miss</span>
        {[event.missVector.radialM, event.missVector.inTrackM, event.missVector.crossTrackM].map((v, i) => (
          <span key={i} className="text-right font-mono tabular-nums text-primary">
            {v}
          </span>
        ))}
        <span className="text-secondary">1σ</span>
        {[event.covariance.radialM, event.covariance.inTrackM, event.covariance.crossTrackM].map((v, i) => (
          <span key={i} className="text-right font-mono tabular-nums text-primary">
            {v}
          </span>
        ))}
      </div>

      <p className={cn('border-t border-border-subtle px-3 py-2.5 text-[11px] leading-relaxed text-secondary', !event.reasoning && 'italic')}>
        {event.reasoning ?? 'No recorded reasoning for this window.'}
      </p>

      <Section
        title="Severity breakdown"
        info="How the Conjunction Severity Index is built: a weighted mean of probability, miss distance and time to closest approach."
      >
        <SeverityBreakdownView breakdown={breakdown} />
      </Section>
      <Section
        title={`Screening history · ${event.assessments.length}`}
        info="Every recorded assessment of this pair, oldest to newest, with the index at that point in time."
      >
        <AssessmentHistory event={event} />
      </Section>
    </div>
  )
}
