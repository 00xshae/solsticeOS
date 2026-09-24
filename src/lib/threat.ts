// Threat rating, following the Solstice OS "Threat Ratings" definition.
//
// Each factor maps to a 0-100 term via  term = base + f * (100 - base),  f in [0, 1]:
//   cheap  f = 1 - cheapest delta-v / delta-v limit
//   quick  f = 1 - quickest transit / projection period
//   soon   f = 1 - (soonest arrival - now) / projection period      (moves with the clock)
// The window rating is their weighted mean (cheap x1, quick x2, soon x2), so contributions sum
// to it. The extremes may come from different sequences: a cheaper, quicker or sooner
// intercept each raises the rating. An object's rating is the max over its windows.
import type { InterceptSequence, ThreatConfig, ThreatFactor, ThreatRating, ThreatTerm } from '@/types'
import { severityBand } from './severity'

export const THREAT_FACTORS: readonly ThreatFactor[] = ['cheap', 'quick', 'soon']

export const DEFAULT_THREAT_CONFIG: ThreatConfig = {
  base: { cheap: 20, quick: 20, soon: 20 },
  weights: { cheap: 1, quick: 2, soon: 2 },
  deltaVLimitMps: 1000,
  projectionPeriodHours: 168,
}

const HOUR_MS = 3_600_000
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export interface SequenceMetrics {
  burn1Ms: number
  /** Burn 2 complete: the chaser is on the target's orbit. */
  arrivalMs: number
  transitS: number
  deltaVMps: number
}

export function sequenceMetrics(sequence: InterceptSequence): SequenceMetrics {
  const [, burn1, , burn2] = sequence.steps
  const burn1Ms = Date.parse(burn1.start)
  return {
    burn1Ms,
    arrivalMs: Date.parse(burn2.end),
    transitS: (Date.parse(burn2.start) - burn1Ms) / 1000,
    deltaVMps: sequence.totalDeltaVMps,
  }
}

/** A sequence can still be flown until its Burn 1 is due. */
export const isSequenceOpen = (sequence: InterceptSequence, nowMs: number) => sequenceMetrics(sequence).burn1Ms >= nowMs

/** Window rating at `nowMs`, or null once every sequence's Burn 1 has passed. */
export function rateWindow(
  sequences: InterceptSequence[],
  nowMs: number,
  config: ThreatConfig = DEFAULT_THREAT_CONFIG,
): ThreatRating | null {
  const open = sequences.filter((s) => isSequenceOpen(s, nowMs)).map(sequenceMetrics)
  if (open.length === 0) return null

  const cheapestDeltaVMps = Math.min(...open.map((m) => m.deltaVMps))
  const quickestTransitS = Math.min(...open.map((m) => m.transitS))
  const soonestArrivalMs = Math.min(...open.map((m) => m.arrivalMs))
  const projectionS = config.projectionPeriodHours * 3600
  const fractions: Record<ThreatFactor, number> = {
    cheap: clamp01(1 - cheapestDeltaVMps / config.deltaVLimitMps),
    quick: clamp01(1 - quickestTransitS / projectionS),
    soon: clamp01(1 - (soonestArrivalMs - nowMs) / HOUR_MS / config.projectionPeriodHours),
  }

  const totalWeight = THREAT_FACTORS.reduce((sum, f) => sum + config.weights[f], 0)
  const terms = {} as Record<ThreatFactor, ThreatTerm>
  for (const factor of THREAT_FACTORS) {
    const base = config.base[factor]
    const score = base + fractions[factor] * (100 - base)
    terms[factor] = { factor, score, contribution: (score * config.weights[factor]) / totalWeight }
  }
  const rating = THREAT_FACTORS.reduce((sum, f) => sum + terms[f].contribution, 0)
  const strongest = THREAT_FACTORS.reduce((a, b) => (terms[b].contribution > terms[a].contribution ? b : a))
  return {
    rating,
    band: severityBand(rating),
    terms,
    strongest,
    cheapestDeltaVMps,
    quickestTransitS,
    soonestArrivalMs,
  }
}

export interface RatedWindow {
  windowId: string
  rating: number
}

/** An object's rating: the worst of its windows, with every contributor listed worst first. */
export function rateObject(windows: RatedWindow[]): { rating: number; contributors: RatedWindow[] } | null {
  const contributors = [...windows].sort((a, b) => b.rating - a.rating)
  return contributors[0] ? { rating: contributors[0].rating, contributors } : null
}

export const THREAT_FACTOR_LABEL: Record<ThreatFactor, string> = {
  cheap: 'Cheapest Δv',
  quick: 'Quickest transit',
  soon: 'Soonest arrival',
}

/** One-line explanation in the Solstice wording. */
export function describeThreat(rating: ThreatRating): string {
  const top = rating.terms[rating.strongest]
  return (
    `Rated ${Math.round(rating.rating)} of 100. The strongest contributor is ` +
    `${THREAT_FACTOR_LABEL[rating.strongest].toLowerCase()} (+${Math.round(top.contribution)}); ` +
    `a cheaper, quicker or sooner intercept each raises the rating.`
  )
}

/** "base cheap 20 · base quick 20 · base soon 20 · delta v limit 1 km/s · projection period 168h" */
export function describeThreatConfig(config: ThreatConfig): string {
  return [
    ...THREAT_FACTORS.map((f) => `base ${f} ${config.base[f]}`),
    `delta v limit ${config.deltaVLimitMps / 1000} km/s`,
    `projection period ${config.projectionPeriodHours}h`,
  ].join(' · ')
}
