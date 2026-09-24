// Maps a burn/coast plan onto a 0..1 timeline track. Burns last seconds and coasts last a day,
// so a proportional layout would hide the burns; instead burns get a fixed slot and coasts
// share the rest by sqrt(duration). Time <-> position is linear within each segment.
import type { ManeuverStep } from '@/types'
import { isBurn, type StepPlan } from './maneuver'

export const BURN_SLOT = 0.06

export interface TimelineSegment {
  step: ManeuverStep
  startMs: number
  endMs: number
  startFrac: number
  endFrac: number
}

export function layoutTimeline(sequence: StepPlan): TimelineSegment[] {
  const steps = sequence.steps
  const burns = steps.filter((s) => isBurn(s.phase)).length
  const coastShare = 1 - burns * BURN_SLOT
  const coastWeight = (s: ManeuverStep) => Math.sqrt(Date.parse(s.end) - Date.parse(s.start))
  const totalCoast = steps.filter((s) => !isBurn(s.phase)).reduce((sum, s) => sum + coastWeight(s), 0)

  let cursor = 0
  return steps.map((step) => {
    const width = isBurn(step.phase) ? BURN_SLOT : (coastWeight(step) / totalCoast) * coastShare
    const segment = {
      step,
      startMs: Date.parse(step.start),
      endMs: Date.parse(step.end),
      startFrac: cursor,
      endFrac: cursor + width,
    }
    cursor += width
    return segment
  })
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function timeToFrac(layout: TimelineSegment[], timeMs: number): number {
  const first = layout[0]!
  const last = layout[layout.length - 1]!
  if (timeMs <= first.startMs) return 0
  if (timeMs >= last.endMs) return 1
  const seg = layout.find((s) => timeMs < s.endMs)!
  const t = (timeMs - seg.startMs) / (seg.endMs - seg.startMs)
  return seg.startFrac + t * (seg.endFrac - seg.startFrac)
}

export function fracToTime(layout: TimelineSegment[], frac: number): number {
  const f = clamp01(frac)
  const seg = layout.find((s) => f < s.endFrac) ?? layout[layout.length - 1]!
  const t = (f - seg.startFrac) / (seg.endFrac - seg.startFrac)
  return seg.startMs + clamp01(t) * (seg.endMs - seg.startMs)
}
