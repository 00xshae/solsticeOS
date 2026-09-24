import { rsoById } from '@/data'
import { formatCountdown, formatKm, formatUtc } from '@/lib/format'
import { deltaVSpentMps, isBurn, maneuveredElementsAt, stepAt } from '@/lib/maneuver'
import { propagateEci } from '@/lib/orbit'
import { selectActiveIntercept, selectDisplayTimeMs, useMissionStore } from '@/store/missionStore'
import type { InterceptSequence, ThreatWindow } from '@/types'
import { Controls, Readout, Shell, Track } from './ManeuverTimeline'

function InterceptReadouts({ window, sequence }: { window: ThreatWindow; sequence: InterceptSequence }) {
  // Throttle to whole displayed seconds; the clock ticks every frame.
  const second = useMissionStore((s) => Math.floor(selectDisplayTimeMs(s) / 1000))
  const t = second * 1000
  const chaser = rsoById.get(window.opposedId)!
  const target = rsoById.get(window.targetId)!
  const step = stepAt(sequence, t)
  const c = propagateEci(maneuveredElementsAt(chaser.elements, sequence, t), t)
  const q = propagateEci(target.elements, t)
  const rangeKm = Math.hypot(c.x - q.x, c.y - q.y, c.z - q.z)
  const arrivalMs = Date.parse(sequence.steps[3].end)

  return (
    <div className="grid grid-cols-5 gap-3">
      <Readout label="Display time (UTC)" value={formatUtc(t)} />
      <Readout label="Chaser phase" value={step.label} tone={isBurn(step.phase) ? 'text-sev-orange' : undefined} />
      <Readout label="Arrival" value={formatCountdown(arrivalMs, t)} />
      <Readout label="Δv spent" value={`${deltaVSpentMps(sequence, t).toFixed(2)} / ${sequence.totalDeltaVMps.toFixed(2)} m/s`} />
      <Readout label={`Range to ${target.name}`} value={formatKm(rangeKm * 1000)} tone={rangeKm < 10 ? 'text-sev-red' : undefined} />
    </div>
  )
}

/** The opposed object's simulated burn-coast-burn approach onto the target. */
export function InterceptTimeline({ window }: { window: ThreatWindow }) {
  const sequence = useMissionStore(selectActiveIntercept)
  const chaser = rsoById.get(window.opposedId)!
  if (!sequence) return null
  return (
    <Shell title={`Intercept sequence · ${chaser.name} (simulated)`} aside={<Controls key={sequence.id} sequence={sequence} />}>
      <div className="space-y-3">
        <div className="font-mono text-[11px] text-ink-muted">
          {sequence.name} · Δv {sequence.totalDeltaVMps.toFixed(2)} m/s · standoff {sequence.standoffKm.toFixed(1)} km
        </div>
        <Track plan={sequence} markerMs={Date.parse(sequence.steps[3].end)} markerLabel="ARRIVAL" />
        <InterceptReadouts window={window} sequence={sequence} />
      </div>
    </Shell>
  )
}
