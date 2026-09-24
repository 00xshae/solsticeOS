import { describe, expect, it } from 'vitest'
import type { InterceptSequence, ManeuverStep } from '@/types'
import { describeThreat, describeThreatConfig, DEFAULT_THREAT_CONFIG, rateObject, rateWindow, sequenceMetrics } from './threat'

const HOUR = 3_600_000
const NOW = Date.parse('2026-10-01T06:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()

/** A sequence with Burn 1 at `burn1Ms`, Burn 2 `transitH` later, each burn lasting a minute. */
function sequence(id: string, burn1Ms: number, transitH: number, deltaVMps: number): InterceptSequence {
  const b2 = burn1Ms + transitH * HOUR
  const step = (phase: ManeuverStep['phase'], start: number, end: number, dv = 0): ManeuverStep => ({
    phase,
    label: phase,
    start: iso(start),
    end: iso(end),
    propagator: 'SGP4',
    deltaVMps: dv,
    direction: dv ? { radial: 0, inTrack: 1, crossTrack: 0 } : null,
  })
  return {
    id,
    windowId: 'TW',
    name: id,
    totalDeltaVMps: deltaVMps,
    standoffKm: 2,
    steps: [
      step('COAST_MEAN_PRE', burn1Ms - HOUR, burn1Ms),
      step('BURN_1', burn1Ms, burn1Ms + 60_000, deltaVMps / 2),
      step('COAST_EPHEMERIS', burn1Ms + 60_000, b2),
      step('BURN_2', b2, b2 + 60_000, deltaVMps / 2),
      step('COAST_MEAN_POST', b2 + 60_000, b2 + 6 * HOUR),
    ],
  }
}

describe('sequence metrics', () => {
  it('measures transit between burns and arrival at the end of Burn 2', () => {
    const m = sequenceMetrics(sequence('A', NOW + HOUR, 10, 12))
    expect(m.transitS).toBe(10 * 3600)
    expect(m.arrivalMs).toBe(NOW + 11 * HOUR + 60_000)
    expect(m.deltaVMps).toBe(12)
  })
})

describe('window rating', () => {
  it('matches the Solstice ISS shadow breakdown (+16 cheap, +39 quick) with soon near its ceiling', () => {
    // 250 m/s is 1/4 of the 1 km/s limit; 5.25 h is 1/32 of the 168 h projection. With Burn 1
    // due now, arrival is 5.27 h out, so soon scores just under its +40 ceiling.
    const rating = rateWindow([sequence('A', NOW, 5.25, 250)], NOW)!
    expect(rating.terms.cheap.contribution).toBeCloseTo(16, 5)
    expect(rating.terms.quick.contribution).toBeCloseTo(39, 5)
    expect(rating.terms.soon.contribution).toBeCloseTo(39, 0)
    expect(Math.round(rating.rating)).toBe(94)
  })

  it('sums contributions to the rating and names the strongest factor', () => {
    const r = rateWindow([sequence('A', NOW + 2 * HOUR, 30, 12)], NOW)!
    const sum = r.terms.cheap.contribution + r.terms.quick.contribution + r.terms.soon.contribution
    expect(sum).toBeCloseTo(r.rating, 10)
    // Arrival can never beat the transit time while Burn 1 is still ahead, so quick leads.
    expect(r.strongest).toBe('quick')
    expect(describeThreat(r)).toMatch(/^Rated \d+ of 100\. The strongest contributor is quickest transit/)
  })

  it('mixes the cheapest, quickest and soonest across sequences', () => {
    const cheap = sequence('cheap', NOW + 40 * HOUR, 80, 5)
    const quick = sequence('quick', NOW + 20 * HOUR, 10, 40)
    const r = rateWindow([cheap, quick], NOW)!
    expect(r.cheapestDeltaVMps).toBe(5)
    expect(r.quickestTransitS).toBe(10 * 3600)
    expect(r.soonestArrivalMs).toBe(sequenceMetrics(quick).arrivalMs)
  })

  it('rises as the soonest arrival draws closer, then closes once every Burn 1 has passed', () => {
    const s = sequence('A', NOW + 24 * HOUR, 20, 10)
    const early = rateWindow([s], NOW)!.rating
    const later = rateWindow([s], NOW + 12 * HOUR)!.rating
    expect(later).toBeGreaterThan(early)
    expect(rateWindow([s], NOW + 24 * HOUR + 1)).toBeNull()
  })

  it('drops expired sequences from the extremes', () => {
    const soon = sequence('soon', NOW + HOUR, 10, 50)
    const late = sequence('late', NOW + 30 * HOUR, 60, 8)
    const after = rateWindow([soon, late], NOW + 2 * HOUR)!
    expect(after.quickestTransitS).toBe(60 * 3600)
    expect(after.cheapestDeltaVMps).toBe(8)
  })
})

describe('object rating', () => {
  it('takes the worst window and lists contributors worst first', () => {
    expect(rateObject([])).toBeNull()
    const r = rateObject([
      { windowId: 'a', rating: 40 },
      { windowId: 'b', rating: 72 },
    ])!
    expect(r.rating).toBe(72)
    expect(r.contributors.map((c) => c.windowId)).toEqual(['b', 'a'])
  })
})

it('describes the rating config the way the Solstice threat log records it', () => {
  expect(describeThreatConfig(DEFAULT_THREAT_CONFIG)).toBe(
    'base cheap 20 · base quick 20 · base soon 20 · delta v limit 1 km/s · projection period 168h',
  )
})
