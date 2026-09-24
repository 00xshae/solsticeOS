import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Crosshair, Pause, Play, Radio, TriangleAlert } from 'lucide-react'
import { rsoById, sequenceById } from '@/data'
import { cn } from '@/lib/cn'
import { formatCountdown, formatKm, formatUtc } from '@/lib/format'
import { deltaVSpentMps, isBurn, maneuveredElementsAt, separationFromNominalKm, stepAt, type StepPlan } from '@/lib/maneuver'
import { propagateEci } from '@/lib/orbit'
import { fracToTime, layoutTimeline, timeToFrac } from '@/lib/timeline'
import {
  selectActiveConjunction,
  selectActiveSequence,
  selectDisplayTimeMs,
  selectSequenceFeasibility,
  useMissionStore,
} from '@/store/missionStore'
import type { ConjunctionEvent, ManeuverPhase, ManeuverSequence } from '@/types'

/** Seconds of wall time for "Play plan" to sweep the whole track. */
const PLAYBACK_SECONDS = 20

const PHASE_CLASS: Record<ManeuverPhase, string> = {
  COAST_MEAN_PRE: 'bg-elevated text-secondary',
  BURN_1: 'bg-sev-orange/85 text-stone-950',
  COAST_EPHEMERIS: 'bg-accent/20 text-accent',
  BURN_2: 'bg-sev-orange/85 text-stone-950',
  COAST_MEAN_POST: 'bg-elevated text-secondary',
}

function durationLabel(ms: number) {
  const s = ms / 1000
  if (s < 120) return `${Math.round(s)} s`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`
}

function CoaTabs({ event }: { event: ConjunctionEvent }) {
  const activeId = useMissionStore((s) => s.activeSequenceId)
  const selectSequence = useMissionStore((s) => s.selectSequence)
  const feasibility = useMissionStore((s) =>
    event.sequenceIds.map((id) => (selectSequenceFeasibility(s, sequenceById.get(id)!)?.feasible ? '1' : '0')).join(''),
  )
  return (
    <div className="flex gap-1" role="tablist" aria-label="Course of action">
      {event.sequenceIds.map((id, i) => {
        const seq = sequenceById.get(id)!
        const feasible = feasibility[i] === '1'
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeId === id}
            onClick={() => selectSequence(id)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-left text-[11px] font-medium transition-colors duration-150 ease-out',
              activeId === id ? 'border-accent/40 bg-accent-muted text-accent' : 'border-border text-secondary hover:border-border-strong hover:text-primary',
            )}
          >
            <span className="flex items-center gap-1">
              {!feasible && <TriangleAlert className="size-3 text-sev-orange-ink" aria-label="Exceeds envelope" />}
              {seq.name}
            </span>
            <span className="block font-mono text-[10px] tabular-nums text-tertiary">
              Δv {seq.totalDeltaVMps.toFixed(2)} m/s · {formatKm(seq.postMissDistanceM)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Readout({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[9px] font-medium uppercase tracking-widest text-tertiary">{label}</div>
      <div className={cn('font-mono text-xs font-medium tabular-nums text-primary', tone)}>{value}</div>
    </div>
  )
}

function Readouts({ event, sequence }: { event: ConjunctionEvent; sequence: ManeuverSequence }) {
  // Throttle to whole displayed seconds; the clock ticks every frame.
  const second = useMissionStore((s) => Math.floor(selectDisplayTimeMs(s) / 1000))
  const t = second * 1000
  const primary = rsoById.get(event.primaryId)!
  const secondary = rsoById.get(event.secondaryId)!
  const step = stepAt(sequence, t)
  const separationKm = separationFromNominalKm(primary.elements, sequence, t)
  const p = propagateEci(maneuveredElementsAt(primary.elements, sequence, t), t)
  const q = propagateEci(secondary.elements, t)
  const rangeKm = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)

  return (
    <div className="grid grid-cols-6 gap-3">
      <Readout label="Display time (UTC)" value={formatUtc(t)} />
      <Readout label="Phase" value={step.label} tone={isBurn(step.phase) ? 'text-sev-orange-ink' : undefined} />
      <Readout label="TCA" value={formatCountdown(Date.parse(event.tca), t)} />
      <Readout label="Δv spent" value={`${deltaVSpentMps(sequence, t).toFixed(2)} / ${sequence.totalDeltaVMps.toFixed(2)} m/s`} />
      <Readout label="Offset vs nominal" value={formatKm(separationKm * 1000)} tone="text-accent" />
      <Readout label={`Range to ${secondary.name}`} value={formatKm(rangeKm * 1000)} tone={rangeKm < 5 ? 'text-sev-red-ink' : undefined} />
    </div>
  )
}

/** Scrubbable 5-stage track with a key-time marker (TCA for COLA, arrival for an intercept). */
export function Track({ plan, markerMs, markerLabel }: { plan: StepPlan; markerMs: number; markerLabel: string }) {
  const layout = useMemo(() => layoutTimeline(plan), [plan])
  const trackRef = useRef<HTMLDivElement>(null)
  const scrubTo = useMissionStore((s) => s.scrubTo)
  const scrubbing = useMissionStore((s) => s.scrubTimeMs !== null)
  const displayFrac = useMissionStore((s) => timeToFrac(layout, selectDisplayTimeMs(s)))
  const clockFrac = useMissionStore((s) => timeToFrac(layout, s.simTimeMs))
  const markerFrac = timeToFrac(layout, markerMs)

  const scrubFromPointer = (e: PointerEvent) => {
    const rect = trackRef.current!.getBoundingClientRect()
    scrubTo(fracToTime(layout, (e.clientX - rect.left) / rect.width))
  }

  return (
    <div
      ref={trackRef}
      className="relative h-14 cursor-ew-resize touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        scrubFromPointer(e)
      }}
      onPointerMove={(e) => e.buttons === 1 && scrubFromPointer(e)}
      role="slider"
      aria-label="Manoeuvre timeline"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(displayFrac * 100)}
      tabIndex={0}
      onKeyDown={(e) => {
        const delta = e.key === 'ArrowRight' ? 0.01 : e.key === 'ArrowLeft' ? -0.01 : 0
        if (delta) scrubTo(fracToTime(layout, displayFrac + delta))
      }}
    >
      <div className="absolute inset-x-0 top-0 flex h-9 overflow-hidden rounded-lg">
        {layout.map((seg) => (
          <div
            key={seg.step.phase}
            className={cn('flex min-w-0 flex-col justify-center border-r border-surface px-1.5 last:border-r-0', PHASE_CLASS[seg.step.phase])}
            style={{ width: `${(seg.endFrac - seg.startFrac) * 100}%` }}
            title={`${seg.step.label} · ${seg.step.propagator}`}
          >
            <span className="truncate text-[9px] font-semibold uppercase tracking-wider">
              {isBurn(seg.step.phase) ? seg.step.label.replace(/ \(.*\)$/, '') : seg.step.label}
            </span>
            <span className="truncate font-mono text-[9px] tabular-nums opacity-75">
              {isBurn(seg.step.phase) ? `${seg.step.deltaVMps.toFixed(2)} m/s` : durationLabel(seg.endMs - seg.startMs)}
            </span>
          </div>
        ))}
      </div>

      <Marker frac={markerFrac} className="bg-sev-red" label={markerLabel} labelClass="text-sev-red-ink" />
      {clockFrac > 0 && clockFrac < 1 && (
        <Marker frac={clockFrac} className="bg-sev-green/70" label="NOW" labelClass="text-sev-green-ink" />
      )}
      <div
        className={cn(
          'pointer-events-none absolute -top-1 h-11 w-0.5 -translate-x-1/2 rounded-full bg-white transition-[box-shadow,opacity] duration-150 ease-out light:bg-stone-900',
          scrubbing
            ? 'shadow-[0_0_12px_rgba(255,255,255,0.8)] light:shadow-[0_0_8px_rgba(28,25,23,0.35)]'
            : 'shadow-[0_0_8px_rgba(255,255,255,0.5)] light:shadow-none',
        )}
        style={{ left: `${displayFrac * 100}%`, opacity: scrubbing ? 1 : 0.6 }}
      >
        <div className="absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-white light:bg-stone-900" />
      </div>
    </div>
  )
}

function Marker({ frac, className, label, labelClass }: { frac: number; className: string; label: string; labelClass: string }) {
  return (
    <div className="pointer-events-none absolute top-0 h-12" style={{ left: `${frac * 100}%` }}>
      <div className={cn('h-9 w-px', className)} />
      <div className={cn('-translate-x-1/2 pt-0.5 text-[9px] font-semibold tracking-widest', labelClass)}>{label}</div>
    </div>
  )
}

export function Controls({ sequence }: { sequence: StepPlan }) {
  const scrubTo = useMissionStore((s) => s.scrubTo)
  const live = useMissionStore((s) => s.scrubTimeMs === null)
  const followSelected = useMissionStore((s) => s.followSelected)
  const toggleFollow = useMissionStore((s) => s.toggleFollow)
  const [playing, setPlaying] = useState(false)
  const layout = useMemo(() => layoutTimeline(sequence), [sequence])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const s = useMissionStore.getState()
    let frac = s.scrubTimeMs === null ? 0 : timeToFrac(layout, s.scrubTimeMs)
    if (frac >= 1) frac = 0
    const step = (now: number) => {
      frac = Math.min(1, frac + (now - last) / 1000 / PLAYBACK_SECONDS)
      last = now
      scrubTo(fracToTime(layout, frac))
      if (frac < 1) frame = requestAnimationFrame(step)
      else setPlaying(false)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing, layout, scrubTo])

  const button =
    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors duration-100 ease-out'
  const idle = 'border-border text-secondary hover:border-border-strong hover:bg-elevated hover:text-primary'
  const active = 'border-accent/50 bg-accent-muted text-accent'
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        className={cn(button, playing ? active : idle)}
      >
        {playing ? <Pause className="size-3" /> : <Play className="size-3" />} {playing ? 'Pause' : 'Play plan'}
      </button>
      <button
        type="button"
        onClick={() => {
          setPlaying(false)
          scrubTo(null)
        }}
        aria-pressed={live}
        className={cn(button, live ? active : idle)}
      >
        <Radio className="size-3" /> Live
      </button>
      <button
        type="button"
        onClick={toggleFollow}
        aria-pressed={followSelected}
        className={cn(button, followSelected ? active : idle)}
      >
        <Crosshair className="size-3" /> Follow
      </button>
    </div>
  )
}

/** 5-stage COLA timeline: coast (mean) -> burn 1 -> coast (ephemeris) -> burn 2 -> coast (mean). */
export function ManeuverTimeline() {
  const event = useMissionStore(selectActiveConjunction)
  const sequence = useMissionStore(selectActiveSequence)

  if (!event) {
    return (
      <Shell>
        <p className="py-6 text-center text-[12px] text-tertiary">
          Select a threat window or conjunction window to see its manoeuvre sequence
        </p>
      </Shell>
    )
  }
  if (!sequence) {
    const primary = rsoById.get(event.primaryId)
    return (
      <Shell>
        <p className="py-6 text-center text-[12px] text-tertiary">
          {primary?.name} has no propulsion · monitor only
        </p>
      </Shell>
    )
  }

  return (
    <Shell aside={<Controls key={sequence.id} sequence={sequence} />}>
      <div className="space-y-3">
        <CoaTabs event={event} />
        <Track plan={sequence} markerMs={Date.parse(event.tca)} markerLabel="TCA" />
        <Readouts event={event} sequence={sequence} />
      </div>
    </Shell>
  )
}

export function Shell({
  aside,
  children,
  title = 'COLA manoeuvre sequence',
}: {
  aside?: ReactNode
  children: ReactNode
  title?: string
}) {
  return (
    <section className="shrink-0 border-t border-border bg-surface px-4 py-3" aria-label={`${title} timeline`}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-secondary">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
