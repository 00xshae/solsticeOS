import { describe, expect, it } from 'vitest'
import { DEMO_EPOCH_MS, rsoById } from '@/data'
import type { OrbitalElements } from '@/types'
import { EARTH_RADIUS_KM, geoAt, gmstRad, orbitalPeriodS, orbitRing, propagateEci } from './orbit'

const circular: OrbitalElements = {
  epoch: '2026-10-01T00:00:00Z',
  smaKm: 7000,
  ecc: 0,
  incDeg: 98,
  raanDeg: 40,
  argpDeg: 0,
  meanAnomalyDeg: 0,
}
const epochMs = Date.parse(circular.epoch)
const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z)

describe('propagateEci', () => {
  it('keeps a circular orbit at constant radius', () => {
    for (const minutes of [0, 17, 45, 90]) {
      expect(norm(propagateEci(circular, epochMs + minutes * 60_000))).toBeCloseTo(7000, 6)
    }
  })

  it('returns near the start point after one period', () => {
    const start = propagateEci(circular, epochMs)
    const after = propagateEci(circular, epochMs + orbitalPeriodS(7000) * 1000)
    // Only J2 drift separates them: ~0.12% of a revolution in argument of latitude at 98 deg,
    // i.e. about 55 km at this radius.
    const gap = Math.hypot(after.x - start.x, after.y - start.y, after.z - start.z)
    expect(gap).toBeGreaterThan(40)
    expect(gap).toBeLessThan(70)
  })

  it('spans perigee to apogee on an eccentric orbit', () => {
    const el = { ...circular, ecc: 0.1 }
    expect(norm(propagateEci(el, epochMs))).toBeCloseTo(6300, 3)
    expect(norm(propagateEci(el, epochMs + (orbitalPeriodS(7000) * 1000) / 2))).toBeCloseTo(7700, -1)
  })
})

describe('geodetic conversion', () => {
  it('matches GMST at J2000 noon', () => {
    expect(gmstRad(Date.parse('2000-01-01T12:00:00Z')) / (Math.PI / 180)).toBeCloseTo(280.4606, 3)
  })

  it('reaches the inclination-limited latitude on a polar-ish orbit', () => {
    const quarter = epochMs + (orbitalPeriodS(7000) * 1000) / 4
    expect(geoAt(circular, quarter).lat).toBeCloseTo(82, 0)
  })

  it('places catalog objects at their catalog altitude', () => {
    const rsat = rsoById.get('RSAT-2A')!
    const { altKm } = geoAt(rsat.elements, DEMO_EPOCH_MS)
    expect(altKm).toBeGreaterThan(rsat.elements.smaKm * (1 - rsat.elements.ecc) - EARTH_RADIUS_KM - 1)
    expect(altKm).toBeLessThan(rsat.elements.smaKm * (1 + rsat.elements.ecc) - EARTH_RADIUS_KM + 1)
  })

  it('closes the orbit ring', () => {
    const ring = orbitRing(circular, epochMs, 90)
    expect(ring).toHaveLength(91)
    expect(ring[0]!.lat).toBeCloseTo(ring[90]!.lat, 0)
  })
})
