import type { ManeuverEnvelope } from '@/types'

export const G0 = 9.80665

/** Propellant mass (kg) needed to deliver `deltaVMps` from wet mass `massKg` (Tsiolkovsky). */
export function propellantForDeltaV(deltaVMps: number, massKg: number, ispS: number): number {
  if (ispS <= 0) return Infinity
  return massKg * (1 - Math.exp(-deltaVMps / (ispS * G0)))
}

/** Seconds of thrust per 1 m/s of delta-v at current mass. */
export function burnSecondsPerMps(envelope: Pick<ManeuverEnvelope, 'massKg' | 'thrustN'>): number {
  return envelope.thrustN > 0 ? envelope.massKg / envelope.thrustN : Infinity
}
