import { describe, expect, it } from 'vitest'
import { conjunctionById, maneuverSequences, sequenceById } from '@/data'
import { BURN_SLOT, fracToTime, layoutTimeline, timeToFrac } from './timeline'

const sequence = sequenceById.get('SEQ-001-A')!
const layout = layoutTimeline(sequence)

describe('layoutTimeline', () => {
  it('tiles 0..1 with contiguous segments', () => {
    expect(layout[0]!.startFrac).toBe(0)
    expect(layout.at(-1)!.endFrac).toBeCloseTo(1, 12)
    layout.slice(1).forEach((seg, i) => expect(seg.startFrac).toBeCloseTo(layout[i]!.endFrac, 12))
  })

  it('gives each burn a fixed, visible slot', () => {
    for (const seg of layout.filter((s) => s.step.phase.startsWith('BURN'))) {
      expect(seg.endFrac - seg.startFrac).toBeCloseTo(BURN_SLOT)
    }
  })

  it('places TCA inside the ephemeris coast for every plan', () => {
    for (const s of maneuverSequences) {
      const l = layoutTimeline(s)
      const f = timeToFrac(l, Date.parse(conjunctionById.get(s.conjunctionId)!.tca))
      expect(f).toBeGreaterThan(l[2]!.startFrac)
      expect(f).toBeLessThan(l[2]!.endFrac)
    }
  })
})

describe('time <-> fraction', () => {
  it('round-trips and clamps', () => {
    for (const f of [0, 0.1, 0.33, 0.5, 0.71, 0.99]) expect(timeToFrac(layout, fracToTime(layout, f))).toBeCloseTo(f, 9)
    expect(timeToFrac(layout, 0)).toBe(0)
    expect(timeToFrac(layout, Number.MAX_SAFE_INTEGER)).toBe(1)
    expect(fracToTime(layout, 2)).toBe(layout.at(-1)!.endMs)
  })

  it('is monotonic', () => {
    const times = Array.from({ length: 101 }, (_, i) => fracToTime(layout, i / 100))
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})
