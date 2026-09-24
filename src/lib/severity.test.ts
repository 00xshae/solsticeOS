import { describe, expect, it } from 'vitest'
import { conjunctionById, conjunctions, DEMO_EPOCH_MS } from '@/data'
import {
  aggregateSeverity,
  computeSeverity,
  DEFAULT_SEVERITY_CONFIG,
  describeSeverity,
  severityBand,
  type SeverityInput,
} from './severity'

const HOUR = 3_600_000
const tcaIn = (hours: number) => new Date(DEMO_EPOCH_MS + hours * HOUR).toISOString()
const input = (overrides: Partial<SeverityInput> = {}): SeverityInput => ({
  pc: 1e-5,
  missDistanceM: 1000,
  tca: tcaIn(48),
  screeningRadiusKm: 5,
  ...overrides,
})

describe('computeSeverity', () => {
  it('scores the base when every factor is at its benign extreme', () => {
    const result = computeSeverity(input({ pc: 1e-9, missDistanceM: 6000, tca: tcaIn(500) }), DEMO_EPOCH_MS)
    expect(result.index).toBeCloseTo(20)
    expect(result.band).toBe('blue')
  })

  it('scores 100 when every factor is at its severe extreme', () => {
    const result = computeSeverity(input({ pc: 1e-2, missDistanceM: 0, tca: tcaIn(0) }), DEMO_EPOCH_MS)
    expect(result.index).toBeCloseTo(100)
    expect(result.band).toBe('red')
  })

  it('has contributions that sum to the index', () => {
    const r = computeSeverity(input(), DEMO_EPOCH_MS)
    const sum = r.terms.probability.contribution + r.terms.proximity.contribution + r.terms.imminence.contribution
    expect(sum).toBeCloseTo(r.index, 10)
  })

  it('log-scales Pc between floor and ceiling', () => {
    const mid = computeSeverity(input({ pc: 1e-5 }), DEMO_EPOCH_MS).terms.probability.score
    expect(mid).toBeCloseTo(20 + 0.5 * 80)
  })

  it('rises as TCA approaches and drops once it passes', () => {
    const e = input({ tca: tcaIn(24) })
    const early = computeSeverity(e, DEMO_EPOCH_MS).index
    const later = computeSeverity(e, DEMO_EPOCH_MS + 20 * HOUR).index
    const after = computeSeverity(e, DEMO_EPOCH_MS + 25 * HOUR)
    expect(later).toBeGreaterThan(early)
    expect(after.terms.imminence.score).toBe(DEFAULT_SEVERITY_CONFIG.base.imminence)
  })

  it('names the strongest contributor in its description', () => {
    const r = computeSeverity(conjunctionById.get('CJ-001')!, DEMO_EPOCH_MS)
    expect(describeSeverity(r)).toMatch(/^Rated \d+ of 100\. The strongest contributor is /)
  })
})

describe('severityBand', () => {
  it.each([
    [0, 'green'],
    [19.9, 'green'],
    [20, 'blue'],
    [40, 'yellow'],
    [60, 'orange'],
    [80, 'red'],
    [100, 'red'],
  ])('%d -> %s', (index, band) => expect(severityBand(index)).toBe(band))
})

describe('demo scenario', () => {
  const at = (id: string) => computeSeverity(conjunctionById.get(id)!, DEMO_EPOCH_MS)

  it('opens with the hero conjunction in the red band and ranked first', () => {
    expect(at('CJ-001').band).toBe('red')
    const ranked = [...conjunctions].sort((a, b) => at(b.id).index - at(a.id).index)
    expect(ranked[0]!.id).toBe('CJ-001')
  })

  it('shows the hero index climbing across successive screenings', () => {
    const event = conjunctionById.get('CJ-001')!
    const history = event.assessments.map(
      (a) => computeSeverity({ ...a, screeningRadiusKm: event.screeningRadiusKm }, Date.parse(a.assessedAt)).index,
    )
    expect(history).toEqual([...history].sort((a, b) => a - b))
  })

  it('aggregates to the worst open conjunction per object', () => {
    const agg = aggregateSeverity('RSAT-2A', 'vulnerable', conjunctions, DEMO_EPOCH_MS)
    expect(agg?.conjunctionIds).toEqual(['CJ-001'])
    expect(agg?.index).toBeCloseTo(at('CJ-001').index)
    expect(aggregateSeverity('ISS', 'vulnerable', conjunctions, DEMO_EPOCH_MS)).toBeNull()
    const closed = Date.parse(conjunctionById.get('CJ-001')!.windowEnd) + 1
    expect(aggregateSeverity('RSAT-2A', 'vulnerable', conjunctions, closed)).toBeNull()
  })
})
