import { describe, expect, it } from 'vitest'
import { conjunctionById, rsoById, sequenceById } from '@/data'
import {
  deltaVSpentMps,
  maneuveredElementsAt,
  separationFromNominalKm,
  stepAt,
} from './maneuver'
import { circularSpeedKmS, orbitalPeriodS } from './orbit'

const sequence = sequenceById.get('SEQ-001-A')!
const base = rsoById.get('RSAT-2A')!.elements
const at = (i: number, edge: 'start' | 'end') => Date.parse(sequence.steps[i]![edge])
const tca = Date.parse(conjunctionById.get('CJ-001')!.tca)

describe('maneuveredElementsAt', () => {
  it('follows the nominal orbit before Burn 1', () => {
    expect(maneuveredElementsAt(base, sequence, at(1, 'start') - 1)).toBe(base)
    expect(separationFromNominalKm(base, sequence, at(1, 'start') - 1)).toBe(0)
  })

  it('raises the semi-major axis at Burn 1 and restores it at Burn 2', () => {
    const dv = sequence.steps[1].deltaVMps / 1000
    const expectedDa = (2 * base.smaKm * dv) / circularSpeedKmS(base.smaKm)
    expect(maneuveredElementsAt(base, sequence, at(1, 'end')).smaKm - base.smaKm).toBeCloseTo(expectedDa, 6)
    // Restored to within millimetres; burn 2 sees a slightly different circular speed.
    expect(maneuveredElementsAt(base, sequence, at(4, 'start')).smaKm).toBeCloseTo(base.smaKm, 4)
  })

  it('opens along-track separation by TCA consistent with the first-order drift model', () => {
    const daKm = (2 * base.smaKm * (sequence.steps[1].deltaVMps / 1000)) / circularSpeedKmS(base.smaKm)
    const revs = (tca - at(1, 'start')) / (orbitalPeriodS(base.smaKm) * 1000)
    const drift = 3 * Math.PI * daKm * revs
    const separation = separationFromNominalKm(base, sequence, tca)
    expect(separation).toBeGreaterThan(drift * 0.7)
    expect(separation).toBeLessThan(drift * 1.3)
  })

  it('stays continuous across a burn', () => {
    const justAfter = separationFromNominalKm(base, sequence, at(1, 'start') + 1000)
    expect(justAfter).toBeLessThan(0.5)
  })
})

describe('sequence helpers', () => {
  it('reports the step in progress and delta-v spent', () => {
    expect(stepAt(sequence, at(0, 'start')).phase).toBe('COAST_MEAN_PRE')
    expect(stepAt(sequence, tca).phase).toBe('COAST_EPHEMERIS')
    expect(stepAt(sequence, at(4, 'end') + 1).phase).toBe('COAST_MEAN_POST')
    expect(deltaVSpentMps(sequence, tca)).toBeCloseTo(sequence.steps[1].deltaVMps)
    expect(deltaVSpentMps(sequence, at(4, 'end'))).toBeCloseTo(sequence.totalDeltaVMps)
  })
})
