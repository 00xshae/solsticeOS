import { describe, expect, it } from 'vitest'
import { conjunctionById, DEMO_EPOCH_MS, rsoById, sequenceById } from '@/data'
import { computeSeverity } from './severity'
import { coaMetrics, MIN_DECISION_LEAD_MS, recommendCoa } from './cola'

const event = conjunctionById.get('CJ-001')!
const envelope = rsoById.get('RSAT-2A')!.envelope!
const plans = event.sequenceIds.map((id) => sequenceById.get(id)!)
const metricsAt = (now: number, env = envelope) => plans.map((p) => coaMetrics(p, event, env, now))

describe('coaMetrics', () => {
  it('reports cost, lead time and post-burn severity', () => {
    const [optimal] = metricsAt(DEMO_EPOCH_MS)
    expect(optimal!.budgetShare).toBeCloseTo(0.16 / 18.4)
    expect(optimal!.burnDurationS).toBeCloseTo((0.08 * 1235) / 11)
    expect(optimal!.decisionLeadMs).toBe(Date.parse(plans[0]!.steps[1].start) - DEMO_EPOCH_MS)
    expect(optimal!.postIndex).toBeLessThan(computeSeverity(event, DEMO_EPOCH_MS).index)
    expect(optimal!.feasible).toBe(true)
  })

  it('blocks plans that exceed the budget or are too late to upload', () => {
    const lowFuel = metricsAt(DEMO_EPOCH_MS, { ...envelope, deltaVRemainingMps: 0.2 })
    expect(lowFuel.map((m) => m.blocker)).toEqual([null, 'Exceeds remaining Δv', 'Exceeds remaining Δv'])

    const optimalB1 = Date.parse(plans[0]!.steps[1].start)
    expect(coaMetrics(plans[0]!, event, envelope, optimalB1 - MIN_DECISION_LEAD_MS / 2).blocker).toBe('Too late to upload')
    expect(coaMetrics(plans[0]!, event, envelope, optimalB1 + 1).blocker).toBe('Burn 1 has passed')
  })

  it('treats a missing envelope as no propulsion', () => {
    expect(coaMetrics(plans[0]!, event, null, DEMO_EPOCH_MS)).toMatchObject({ feasible: false, blocker: 'No usable propulsion' })
  })
})

describe('recommendCoa', () => {
  it('picks the cheapest feasible plan', () => {
    expect(recommendCoa(metricsAt(DEMO_EPOCH_MS))).toBe('SEQ-001-A')
  })

  it('falls back once the cheapest plan is too late', () => {
    // Just inside the Optimal Fuel upload deadline, Balanced and Rapid Clearance are still open.
    const late = Date.parse(plans[0]!.steps[1].start) - MIN_DECISION_LEAD_MS / 2
    expect(recommendCoa(metricsAt(late))).toBe('SEQ-001-C')
  })

  it('returns null when nothing is feasible', () => {
    expect(recommendCoa(metricsAt(DEMO_EPOCH_MS, { ...envelope, deltaVRemainingMps: 0 }))).toBeNull()
  })
})
