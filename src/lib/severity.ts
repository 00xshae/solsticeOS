// Conjunction Severity Index (CSI).
//
// Adapted from the Solstice OS threat rating: each factor maps to a 0-100 term via
//   term = base + f * (100 - base),  f in [0, 1]
// and the index is the weighted mean of the terms, so per-term contributions sum to it.
//
//   probability  f = log-scaled Pc between pcFloor and pcCeiling          (weight 2)
//   proximity    f = 1 - missDistance / screeningRadius                   (weight 1)
//   imminence    f = 1 - (tca - now) / projectionPeriod, time-dependent   (weight 2)
//
// Proximity is down-weighted because Pc already folds miss distance in with its covariance.
import type {
  ConjunctionEvent,
  SeverityBand,
  SeverityBreakdown,
  SeverityConfig,
  SeverityFactor,
  SeverityTerm,
} from '@/types'

export const SEVERITY_FACTORS: readonly SeverityFactor[] = ['probability', 'proximity', 'imminence']

export const DEFAULT_SEVERITY_CONFIG: SeverityConfig = {
  base: { probability: 20, proximity: 20, imminence: 20 },
  weights: { probability: 2, proximity: 1, imminence: 2 },
  pcFloor: 1e-7,
  pcCeiling: 1e-3,
  projectionPeriodHours: 168,
}

/** The subset of a conjunction the index depends on; also satisfied by a ConjunctionAssessment. */
export interface SeverityInput {
  pc: number
  missDistanceM: number
  tca: string
  screeningRadiusKm: number
}

const HOUR_MS = 3_600_000

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function factorFractions(input: SeverityInput, nowMs: number, config: SeverityConfig) {
  const logSpan = Math.log10(config.pcCeiling) - Math.log10(config.pcFloor)
  const pcFraction = input.pc > 0 ? (Math.log10(input.pc) - Math.log10(config.pcFloor)) / logSpan : 0
  const hoursToTca = (Date.parse(input.tca) - nowMs) / HOUR_MS
  return {
    probability: clamp01(pcFraction),
    proximity: clamp01(1 - input.missDistanceM / (input.screeningRadiusKm * 1000)),
    // A passed TCA no longer threatens anything.
    imminence: hoursToTca < 0 ? 0 : clamp01(1 - hoursToTca / config.projectionPeriodHours),
  } satisfies Record<SeverityFactor, number>
}

export function severityBand(index: number): SeverityBand {
  if (index < 20) return 'green'
  if (index < 40) return 'blue'
  if (index < 60) return 'yellow'
  if (index < 80) return 'orange'
  return 'red'
}

export function computeSeverity(
  input: SeverityInput,
  nowMs: number,
  config: SeverityConfig = DEFAULT_SEVERITY_CONFIG,
): SeverityBreakdown {
  const fractions = factorFractions(input, nowMs, config)
  const totalWeight = SEVERITY_FACTORS.reduce((sum, f) => sum + config.weights[f], 0)

  const terms = {} as Record<SeverityFactor, SeverityTerm>
  for (const factor of SEVERITY_FACTORS) {
    const base = config.base[factor]
    const score = base + fractions[factor] * (100 - base)
    terms[factor] = { factor, score, contribution: (score * config.weights[factor]) / totalWeight }
  }

  const index = SEVERITY_FACTORS.reduce((sum, f) => sum + terms[f].contribution, 0)
  const strongest = SEVERITY_FACTORS.reduce((a, b) => (terms[b].contribution > terms[a].contribution ? b : a))

  return { index, band: severityBand(index), terms, strongest, evaluatedAt: new Date(nowMs).toISOString() }
}

export function isConjunctionOpen(event: ConjunctionEvent, nowMs: number): boolean {
  return nowMs <= Date.parse(event.windowEnd)
}

/**
 * Aggregate index for one object: the max over its open conjunctions, as in the Solstice
 * aggregate rating. Protected assets aggregate as primary ("vulnerable"); uncooperative
 * objects as secondary ("endangering").
 */
export function aggregateSeverity(
  objectId: string,
  role: 'vulnerable' | 'endangering',
  events: ConjunctionEvent[],
  nowMs: number,
  config: SeverityConfig = DEFAULT_SEVERITY_CONFIG,
): { index: number; conjunctionIds: string[] } | null {
  const key = role === 'vulnerable' ? 'primaryId' : 'secondaryId'
  const scored = events
    .filter((e) => e[key] === objectId && isConjunctionOpen(e, nowMs))
    .map((e) => ({ id: e.id, index: computeSeverity(e, nowMs, config).index }))
    .sort((a, b) => b.index - a.index)
  const worst = scored[0]
  if (!worst) return null
  return { index: worst.index, conjunctionIds: scored.map((s) => s.id) }
}

const FACTOR_LABEL: Record<SeverityFactor, string> = {
  probability: 'probability of collision',
  proximity: 'miss distance',
  imminence: 'time to closest approach',
}

/** One-line explanation, e.g. "Rated 90 of 100. The strongest contributor is ...". */
export function describeSeverity(breakdown: SeverityBreakdown): string {
  const top = breakdown.terms[breakdown.strongest]
  return (
    `Rated ${Math.round(breakdown.index)} of 100. The strongest contributor is ` +
    `${FACTOR_LABEL[breakdown.strongest]} (+${Math.round(top.contribution)}); a higher Pc, ` +
    `a tighter miss or a sooner TCA each raises the index.`
  )
}
