import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Crosshair, Pause, Play, Radio, TriangleAlert } from 'lucide-react'
import { rsoById, sequenceById } from '@/data'
import { cn } from '@/lib/cn'
import { formatCountdown, formatKm, formatUtc } from '@/lib/format'
import { deltaVSpentMps, isBurn, maneuveredElementsAt, separationFromNominalKm, stepAt } from '@/lib/maneuver'
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
  COAST_MEAN_PRE: 'bg-panel-raised text-ink-muted',
  BURN_1: 'bg-sev-orange/80 text-void',
  COAST_EPHEMERIS: 'bg-protected/25 text-protected',
  BURN_2: 'bg-sev-orange/80 text-void',
  COAST_MEAN_POST: 'bg-panel-raised text-ink-muted',
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
              'rounded border px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wider',
              activeId === id ? 'border-protected bg-protected/10 text-protected' : 'border-line text-ink-muted hover:text-ink',
            )}
          >
            <span className="flex items-center gap-1">
              {!feasible && <TriangleAlert className="size-3 text-sev-orange" aria-label="Exceeds envelope" />}
              {seq.name}
            </span>
            <span className="text-ink-faint normal-case tracking-normal">
              Δv {seq.totalDeltaVMps.toFixed(2)} m/s · {formatKm(seq.postMissDistanceM)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Readout({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">{label}</div>
      <div className={cn('font-mono text-xs tabular-nums text-ink', tone)}>{value}</div>
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
      <Readout label="Phase" value={step.label} tone={isBurn(step.phase) ? 'text-sev-orange' : undefined} />
      <Readout label="TCA" value={formatCountdown(Date.parse(event.tca), t)} />
      <Readout label="Δv spent" value={`${deltaVSpentMps(sequence, t).toFixed(2)} / ${sequence.totalDeltaVMps.toFixed(2)} m/s`} />
      <Readout label="Offset vs nominal" value={formatKm(separationKm * 1000)} tone="text-protected" />
      <Readout label={`Range to ${secondary.name}`} value={formatKm(rangeKm * 1000)} tone={rangeKm < 5 ? 'text-sev-red' : undefined} />
    </div>
  )
}

function Track({ event, sequence }: { event: ConjunctionEvent; sequence: ManeuverSequence }) {
  const layout = useMemo(() => layoutTimeline(sequence), [sequence])
  const trackRef = useRef<HTMLDivElement>(null)
  const scrubTo = useMissionStore((s) => s.scrubTo)
  const scrubbing = useMissionStore((s) => s.scrubTimeMs !== null)
  const displayFrac = useMissionStore((s) => timeToFrac(layout, selectDisplayTimeMs(s)))
  const clockFrac = useMissionStore((s) => timeToFrac(layout, s.simTimeMs))
  const tcaFrac = timeToFrac(layout, Date.parse(event.tca))

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
      <div className="absolute inset-x-0 top-0 flex h-9 overflow-hidden rounded">
        {layout.map((seg) => (
          <div
            key={seg.step.phase}
            className={cn('flex min-w-0 flex-col justify-center border-r border-void px-1.5', PHASE_CLASS[seg.step.phase])}
            style={{ width: `${(seg.endFrac - seg.startFrac) * 100}%` }}
            title={`${seg.step.label} · ${seg.step.propagator}`}
          >
            <span className="truncate font-mono text-[9px] font-semibold uppercase tracking-wider">{seg.step.label}</span>
            <span className="truncate font-mono text-[9px] opacity-75">
              {isBurn(seg.step.phase) ? `${seg.step.deltaVMps.toFixed(2)} m/s` : durationLabel(seg.endMs - seg.startMs)}
            </span>
          </div>
        ))}
      </div>

      <Marker frac={tcaFrac} className="bg-sev-red" label="TCA" labelClass="text-sev-red" />
      {clockFrac > 0 && clockFrac < 1 && (
        <Marker frac={clockFrac} className="bg-cooperative/70" label="NOW" labelClass="text-cooperative" />
      )}
      <div
        className="pointer-events-none absolute -top-1 h-11 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_white]"
        style={{ left: `${displayFrac * 100}%`, opacity: scrubbing ? 1 : 0.6 }}
      >
        <div className="absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-white" />
      </div>
    </div>
  )
}

function Marker({ frac, className, label, labelClass }: { frac: number; className: string; label: string; labelClass: string }) {
  return (
    <div className="pointer-events-none absolute top-0 h-12" style={{ left: `${frac * 100}%` }}>
      <div className={cn('h-9 w-px', className)} />
      <div className={cn('-translate-x-1/2 font-mono text-[9px] font-semibold tracking-widest', labelClass)}>{label}</div>
    </div>
  )
}

function Controls({ sequence }: { sequence: ManeuverSequence }) {
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

  const button = 'flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider'
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        className={cn(button, playing ? 'border-protected text-protected' : 'border-line text-ink-muted hover:text-ink')}
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
        className={cn(button, live ? 'border-cooperative text-cooperative' : 'border-line text-ink-muted hover:text-ink')}
      >
        <Radio className="size-3" /> Live
      </button>
      <button
        type="button"
        onClick={toggleFollow}
        aria-pressed={followSelected}
        className={cn(button, followSelected ? 'border-protected text-protected' : 'border-line text-ink-muted hover:text-ink')}
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
        <p className="py-6 text-center font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          Select a conjunction window to plan a collision-avoidance manoeuvre
        </p>
      </Shell>
    )
  }
  if (!sequence) {
    const primary = rsoById.get(event.primaryId)
    return (
      <Shell>
        <p className="py-6 text-center font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          {primary?.name} has no propulsion · monitor only
        </p>
      </Shell>
    )
  }

  return (
    <Shell aside={<Controls key={sequence.id} sequence={sequence} />}>
      <div className="space-y-3">
        <CoaTabs event={event} />
        <Track event={event} sequence={sequence} />
        <Readouts event={event} sequence={sequence} />
      </div>
    </Shell>
  )
}

function Shell({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="shrink-0 border-t border-line bg-panel px-4 py-3" aria-label="COLA manoeuvre timeline">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
          COLA manoeuvre sequence
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
