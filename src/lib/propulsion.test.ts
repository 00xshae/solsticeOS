import { describe, expect, it } from 'vitest'
import { burnSecondsPerMps, propellantForDeltaV } from './propulsion'

describe('propulsion', () => {
  it('matches the rocket equation', () => {
    // 1 km/s at Isp 300 s burns ~28.8% of wet mass.
    expect(propellantForDeltaV(1000, 1000, 300)).toBeCloseTo(288.3, 0)
  })

  it('returns zero propellant for zero delta-v and infinity without Isp', () => {
    expect(propellantForDeltaV(0, 500, 220)).toBe(0)
    expect(propellantForDeltaV(1, 500, 0)).toBe(Infinity)
  })

  it('derives burn time per m/s from thrust and mass', () => {
    expect(burnSecondsPerMps({ massKg: 1235, thrustN: 11 })).toBeCloseTo(112.3, 1)
    expect(burnSecondsPerMps({ massKg: 50, thrustN: 0 })).toBe(Infinity)
  })
})
