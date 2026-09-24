import { describe, expect, it } from 'vitest'
import type { CatalogSegment, ManeuverPhase, RsoListCategory } from '@/types'
import {
  conjunctionById,
  conjunctions,
  DEMO_EPOCH_MS,
  interceptSequences,
  maneuverSequences,
  rsoById,
  rsoLists,
  rsoObjects,
  sequencesOfWindow,
  threatWindowById,
  threatWindows,
} from '.'
import { maneuveredElementsAt } from '@/lib/maneuver'
import { propagateEci } from '@/lib/orbit'
import { severityBand } from '@/lib/severity'
import { rateWindow } from '@/lib/threat'

const SEGMENTS: CatalogSegment[] = ['IND', 'PAY', 'RB', 'DEB']
const CATEGORIES: RsoListCategory[] = ['owned', 'allied', 'opposed']
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
  const protectedIds = membersOf('owned')
  const uncooperativeIds = membersOf('opposed')

  it('screens only owned x opposed pairs', () => {
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

  it('puts the secondary on the primary at TCA so the globe geometry agrees', () => {
    for (const e of conjunctions) {
      const t = Date.parse(e.tca)
      const p = propagateEci(rsoById.get(e.primaryId)!.elements, t)
      const s = propagateEci(rsoById.get(e.secondaryId)!.elements, t)
      expect(Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z), e.id).toBeLessThan(1)
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

describe('threat windows', () => {
  it('pair a target with a manoeuvrable chaser and link both ways to their sequences', () => {
    for (const w of threatWindows) {
      expect(rsoById.has(w.targetId), w.id).toBe(true)
      expect(rsoById.get(w.opposedId)?.envelope, w.id).not.toBeNull()
      expect(sequencesOfWindow.get(w.id)!.length, w.id).toBeGreaterThanOrEqual(20)
      for (const s of sequencesOfWindow.get(w.id)!) expect(s.windowId).toBe(w.id)
    }
    expect(new Set(threatWindows.flatMap((w) => w.sequenceIds))).toEqual(new Set(interceptSequences.map((s) => s.id)))
  })

  it('span their sequences from the first Burn 1 to the last arrival', () => {
    for (const w of threatWindows) {
      const seqs = sequencesOfWindow.get(w.id)!
      expect(w.start).toBe(seqs.map((s) => s.steps[1].start).sort()[0])
      expect(w.end).toBe(seqs.map((s) => s.steps[3].end).sort().at(-1))
    }
  })

  it('run the five phases in order within the chaser delta-v budget', () => {
    for (const s of interceptSequences) {
      expect(s.steps.map((step) => step.phase)).toEqual(PHASES)
      s.steps.forEach((step, i) => {
        expect(Date.parse(step.end), `${s.id} ${step.phase}`).toBeGreaterThan(Date.parse(step.start))
        const next = s.steps[i + 1]
        if (next) expect(next.start).toBe(step.end)
      })
      const burns = s.steps.reduce((sum, step) => sum + step.deltaVMps, 0)
      expect(burns).toBeCloseTo(s.totalDeltaVMps, 1)
      const chaser = rsoById.get(threatWindowById.get(s.windowId)!.opposedId)!
      expect(s.totalDeltaVMps).toBeLessThanOrEqual(chaser.envelope!.deltaVRemainingMps)
    }
  })

  it('bring the chaser to its recorded standoff when flown by the app propagator', () => {
    for (const s of interceptSequences) {
      const w = threatWindowById.get(s.windowId)!
      const chaser = rsoById.get(w.opposedId)!.elements
      const target = rsoById.get(w.targetId)!.elements
      const settled = Date.parse(s.steps[3].end) + 10 * 60_000
      const c = propagateEci(maneuveredElementsAt(chaser, s, settled), settled)
      const t = propagateEci(target, settled)
      const range = Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z)
      expect(range, s.id).toBeCloseTo(s.standoffKm, 1)
      expect(range, s.id).toBeLessThan(3)
    }
  })

  it('rate Cartosat-3 red, RISAT-2B orange and SPADEX yellow at the demo epoch', () => {
    const rating = (id: string) => rateWindow(sequencesOfWindow.get(id)!, DEMO_EPOCH_MS)!.rating
    expect(severityBand(rating('TW-CARTOSAT-INSP1'))).toBe('red')
    expect(severityBand(rating('TW-RISAT2B-INSP2'))).toBe('orange')
    expect(severityBand(rating('TW-SPADEX'))).toBe('yellow')
  })
})
