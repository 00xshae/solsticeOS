import { describe, expect, it } from 'vitest'
import type { CatalogSegment, ManeuverPhase, RsoListCategory } from '@/types'
import { conjunctionById, conjunctions, maneuverSequences, rsoById, rsoLists, rsoObjects } from '.'

const SEGMENTS: CatalogSegment[] = ['IND', 'PAY', 'RB', 'DEB']
const CATEGORIES: RsoListCategory[] = ['protected', 'cooperative', 'uncooperative']
const PHASES: ManeuverPhase[] = ['COAST_MEAN_PRE', 'BURN_1', 'COAST_EPHEMERIS', 'BURN_2', 'COAST_MEAN_POST']

const membersOf = (category: RsoListCategory) =>
  new Set(rsoLists.filter((l) => l.category === category).flatMap((l) => l.memberIds))

describe('catalog', () => {
  it('has unique ids and known segments', () => {
    expect(rsoById.size).toBe(rsoObjects.length)
    for (const o of rsoObjects) expect(SEGMENTS).toContain(o.segment)
  })

  it('only lists existing objects under known categories', () => {
    for (const list of rsoLists) {
      expect(CATEGORIES).toContain(list.category)
      for (const id of list.memberIds) expect(rsoById.has(id), `${list.id} -> ${id}`).toBe(true)
    }
  })
})

describe('conjunctions', () => {
  const protectedIds = membersOf('protected')
  const uncooperativeIds = membersOf('uncooperative')

  it('screens only protected x uncooperative pairs', () => {
    for (const e of conjunctions) {
      expect(protectedIds.has(e.primaryId), e.id).toBe(true)
      expect(uncooperativeIds.has(e.secondaryId), e.id).toBe(true)
    }
  })

  it('has a miss vector consistent with the miss distance', () => {
    for (const e of conjunctions) {
      const { radialM, inTrackM, crossTrackM } = e.missVector
      expect(Math.hypot(radialM, inTrackM, crossTrackM)).toBeCloseTo(e.missDistanceM, -1)
    }
  })

  it('ends its assessment history on the current values', () => {
    for (const e of conjunctions) {
      const latest = e.assessments.at(-1)!
      expect(latest).toMatchObject({ pc: e.pc, missDistanceM: e.missDistanceM, tca: e.tca })
      const times = e.assessments.map((a) => Date.parse(a.assessedAt))
      expect(times).toEqual([...times].sort((a, b) => a - b))
    }
  })

  it('only offers sequences to manoeuvrable primaries', () => {
    for (const e of conjunctions) {
      if (e.sequenceIds.length > 0) expect(rsoById.get(e.primaryId)!.envelope, e.id).not.toBeNull()
    }
  })
})

describe('manoeuvre sequences', () => {
  it('link both ways to their conjunction', () => {
    for (const s of maneuverSequences) {
      expect(conjunctionById.get(s.conjunctionId)?.sequenceIds).toContain(s.id)
    }
    const referenced = conjunctions.flatMap((e) => e.sequenceIds)
    expect(new Set(referenced)).toEqual(new Set(maneuverSequences.map((s) => s.id)))
  })

  it('run the five phases in order with contiguous, increasing times', () => {
    for (const s of maneuverSequences) {
      expect(s.steps.map((step) => step.phase)).toEqual(PHASES)
      s.steps.forEach((step, i) => {
        expect(Date.parse(step.end), `${s.id} ${step.phase}`).toBeGreaterThan(Date.parse(step.start))
        const next = s.steps[i + 1]
        if (next) expect(next.start).toBe(step.end)
      })
    }
  })

  it('straddle TCA with the ephemeris coast and fit the delta-v budget', () => {
    for (const s of maneuverSequences) {
      const event = conjunctionById.get(s.conjunctionId)!
      const tca = Date.parse(event.tca)
      const coast = s.steps[2]
      expect(Date.parse(coast.start)).toBeLessThan(tca)
      expect(Date.parse(coast.end)).toBeGreaterThan(tca)
      const burns = s.steps.reduce((sum, step) => sum + step.deltaVMps, 0)
      expect(burns).toBeCloseTo(s.totalDeltaVMps, 6)
      expect(s.totalDeltaVMps).toBeLessThanOrEqual(rsoById.get(event.primaryId)!.envelope!.deltaVRemainingMps)
    }
  })
})
