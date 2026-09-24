import { describe, expect, it } from 'vitest'
import { formatCountdown, formatKm, formatPc, formatUtc } from './format'

describe('format', () => {
  const t = Date.parse('2026-10-01T06:00:00Z')
  it('formats UTC', () => expect(formatUtc(t)).toBe('2026-10-01 06:00:00'))
  it('formats countdowns both sides of the target', () => {
    expect(formatCountdown(Date.parse('2026-10-02T11:42:18Z'), t)).toBe('T-29h 42m')
    expect(formatCountdown(t, t + 5 * 60_000)).toBe('T+0h 05m')
  })
  it('formats Pc', () => {
    expect(formatPc(3.1e-4)).toBe('3.1e-4')
    expect(formatPc(1e-10)).toBe('<1e-10')
  })
  it('formats distances', () => {
    expect(formatKm(142)).toBe('142 m')
    expect(formatKm(3782)).toBe('3.78 km')
  })
})
