// Applies a COLA sequence's burns to a spacecraft's mean elements so the globe and timeline
// can show where the protected asset actually is at any scrub time.
//
// Burns are treated as impulsive at their start time (they last seconds to a minute) and
// in-track burns change only the semi-major axis: da = 2 a dv / v. Along-track separation
// then grows naturally from the changed mean motion, matching the first-order model used to
// generate the sequences.
import type { ManeuverPhase, ManeuverStep, OrbitalElements } from '@/types'
import { circularSpeedKmS, elementsAt, propagateEci } from './orbit'

/** Anything flown as a burn/coast step list: COLA plans and intercept sequences alike. */
export interface StepPlan {
  steps: readonly ManeuverStep[]
}

export function applyInTrackBurn(el: OrbitalElements, deltaVMps: number): OrbitalElements {
  const daKm = (2 * el.smaKm * (deltaVMps / 1000)) / circularSpeedKmS(el.smaKm)
  return { ...el, smaKm: el.smaKm + daKm }
}

const signedDeltaV = (step: ManeuverStep) => step.deltaVMps * Math.sign(step.direction?.inTrack ?? 0)

/** Mean elements valid at `timeMs`, with every burn that has started by then applied. */
export function maneuveredElementsAt(
  base: OrbitalElements,
  sequence: StepPlan,
  timeMs: number,
): OrbitalElements {
  let el = base
  for (const step of sequence.steps) {
    const burnMs = Date.parse(step.start)
    if (step.deltaVMps === 0 || burnMs > timeMs) continue
    el = applyInTrackBurn(elementsAt(el, burnMs), signedDeltaV(step))
  }
  return el
}

/** Distance (km) between the nominal and manoeuvred positions at `timeMs`. */
export function separationFromNominalKm(base: OrbitalElements, sequence: StepPlan, timeMs: number): number {
  const a = propagateEci(base, timeMs)
  const b = propagateEci(maneuveredElementsAt(base, sequence, timeMs), timeMs)
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** The step in progress at `timeMs`, clamped to the first and last steps. */
export function stepAt(sequence: StepPlan, timeMs: number): ManeuverStep {
  const steps = sequence.steps
  return steps.find((s) => timeMs < Date.parse(s.end)) ?? steps[steps.length - 1]!
}

/** Delta-v expended by `timeMs`. */
export function deltaVSpentMps(sequence: StepPlan, timeMs: number): number {
  return sequence.steps.reduce((sum, s) => (Date.parse(s.start) <= timeMs ? sum + s.deltaVMps : sum), 0)
}

export const isBurn = (phase: ManeuverPhase) => phase === 'BURN_1' || phase === 'BURN_2'
