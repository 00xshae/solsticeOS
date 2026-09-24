import { describe, expect, it } from 'vitest'
import { conjunctionById, DEMO_EPOCH_MS, rsoById, sequenceById } from '@/data'
import { buildComplianceReport, complianceFileName, EPHEMERIS_STEP_S, ephemerisSpan } from './compliance'
import type { ComplianceFormat } from '@/types'

const object = rsoById.get('RSAT-2A')!
const sequence = sequenceById.get('SEQ-001-A')!
const event = conjunctionById.get('CJ-001')!
const build = (format: ComplianceFormat, envelope = object.envelope) =>
  buildComplianceReport({ event, sequence, object, envelope, nowMs: DEMO_EPOCH_MS, format })

describe('compliance checks', () => {
  it('passes every check for the recommended plan', () => {
    const report = build('CCSDS_OEM')
    expect(report.status).toBe('READY')
    expect(report.checks.every((c) => c.passed)).toBe(true)
  })

  it('drops to DRAFT when the plan exceeds the budget', () => {
    const report = build('CCSDS_OEM', { ...object.envelope!, deltaVRemainingMps: 0.1 })
    expect(report.status).toBe('DRAFT')
    expect(report.checks.find((c) => c.id === 'dv-budget')?.passed).toBe(false)
  })

  it('carries a demo authorization reference, never an official-looking one', () => {
    expect(build('CCSDS_OEM').authorizationRef).toMatch(/^DEMO-/)
  })
})

describe('OEM body', () => {
  const report = build('CCSDS_OEM')
  const lines = report.body.trim().split('\n')
  const states = lines.filter((l) => /^\d{4}-\d{2}-\d{2}T/.test(l))

  it('has a watermarked CCSDS header and metadata', () => {
    expect(lines[0]).toBe('CCSDS_OEM_VERS = 2.0')
    expect(report.body).toContain('NOT AN OFFICIAL IN-SPACe SUBMISSION')
    expect(report.body).toContain(`OBJECT_ID = ${object.cosparId}`)
    expect(report.body).toContain('REF_FRAME = TEME')
  })

  it('covers the span at the stated step with physical states', () => {
    const [start, stop] = ephemerisSpan(sequence)
    expect(states).toHaveLength(Math.floor((stop - start) / (EPHEMERIS_STEP_S * 1000)) + 1)
    for (const line of [states[0]!, states.at(-1)!]) {
      const [, x, y, z, vx, vy, vz] = line.trim().split(/\s+/).map(Number)
      const { smaKm, ecc } = object.elements
      const radius = Math.hypot(x!, y!, z!)
      // Within perigee..apogee, plus the few hundred metres the burns add.
      expect(radius).toBeGreaterThan(smaKm * (1 - ecc) - 1)
      expect(radius).toBeLessThan(smaKm * (1 + ecc) + 1)
      expect(Math.hypot(vx!, vy!, vz!)).toBeCloseTo(7.44, 1)
    }
  })

  it('is named for its filing', () => {
    expect(complianceFileName(report)).toMatch(/^OR-SEQ-001-A-\d{12}\.oem$/)
  })
})

describe('OCM body', () => {
  it('lists both burns with opposite in-track delta-v', () => {
    const body = build('CCSDS_OCM').body
    expect(body).toContain('MAN_PURPOSE = COLLISION_AVOIDANCE')
    expect(body).toContain('with SL-16 R/B (NORAD 22285)')
    const burns = body.split('\n').filter((l) => /^\d{4}-.* [-\d. ]+$/.test(l) && l.includes('0.0000'))
    expect(burns).toHaveLength(2)
    const inTrack = burns.map((l) => Number(l.trim().split(/\s+/)[3]))
    expect(inTrack[0]).toBeCloseTo(0.00008, 8)
    expect(inTrack[1]).toBeCloseTo(-0.00008, 8)
  })
})
