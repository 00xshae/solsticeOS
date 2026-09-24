// Course-of-action (COA) trade-offs for collision avoidance.
//
// Each plan is scored on what an operator weighs: delta-v cost against the remaining budget,
// how long they can wait before committing (the Burn 1 deadline), and the predicted
// geometry after the burn, re-expressed as a Conjunction Severity Index.
import type { ConjunctionEvent, ManeuverEnvelope, ManeuverSequence } from '@/types'
import { computeSeverity } from './severity'

/** Minimum time between committing a plan and Burn 1 for upload and verification. */
export const MIN_DECISION_LEAD_MS = 60 * 60_000

export interface CoaMetrics {
  sequenceId: string
  totalDeltaVMps: number
  /** Fraction of remaining delta-v the plan consumes. */
  budgetShare: number
  burnDurationS: number
  /** Time left to commit before Burn 1; negative once Burn 1 has passed. */
  decisionLeadMs: number
  postMissDistanceM: number
  postPc: number
  postIndex: number
  feasible: boolean
  /** Why the plan cannot be executed, when it cannot. */
  blocker: string | null
}

export function coaMetrics(
  sequence: ManeuverSequence,
  event: ConjunctionEvent,
  envelope: ManeuverEnvelope | null,
  nowMs: number,
  screeningRadiusKm = event.screeningRadiusKm,
): CoaMetrics {
  const decisionLeadMs = Date.parse(sequence.steps[1].start) - nowMs
  const perBurn = sequence.steps[1].deltaVMps
  const remaining = envelope?.deltaVRemainingMps ?? 0
  const thrust = envelope?.thrustN ?? 0

  let blocker: string | null = null
  if (!envelope || thrust <= 0) blocker = 'No usable propulsion'
  else if (sequence.totalDeltaVMps > remaining) blocker = 'Exceeds remaining Δv'
  else if (decisionLeadMs < MIN_DECISION_LEAD_MS) blocker = decisionLeadMs < 0 ? 'Burn 1 has passed' : 'Too late to upload'

  const post = computeSeverity(
    { pc: sequence.postPc, missDistanceM: sequence.postMissDistanceM, tca: event.tca, screeningRadiusKm },
    nowMs,
  )

  return {
    sequenceId: sequence.id,
    totalDeltaVMps: sequence.totalDeltaVMps,
    budgetShare: remaining > 0 ? sequence.totalDeltaVMps / remaining : Infinity,
    burnDurationS: thrust > 0 && envelope ? (perBurn * envelope.massKg) / thrust : Infinity,
    decisionLeadMs,
    postMissDistanceM: sequence.postMissDistanceM,
    postPc: sequence.postPc,
    postIndex: post.index,
    feasible: blocker === null,
    blocker,
  }
}

/**
 * Cheapest feasible plan; ties go to the larger post-burn miss distance. Null when nothing is
 * feasible, so the UI can say so rather than recommend an impossible plan.
 */
export function recommendCoa(metrics: CoaMetrics[]): string | null {
  const feasible = metrics.filter((m) => m.feasible)
  if (feasible.length === 0) return null
  return feasible.reduce((best, m) =>
    m.totalDeltaVMps < best.totalDeltaVMps ||
    (m.totalDeltaVMps === best.totalDeltaVMps && m.postMissDistanceM > best.postMissDistanceM)
      ? m
      : best,
  ).sequenceId
}
