import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_EPOCH_MS, sequenceById } from '@/data'
import {
  initialMissionState,
  rsoCategories,
  selectActiveSequence,
  selectAggregateSeverity,
  selectConjunctionsBySeverity,
  selectDisplayTimeMs,
  selectEffectiveEnvelope,
  selectFilteredObjects,
  selectSequenceFeasibility,
  selectSeverity,
  useMissionStore,
} from './missionStore'

const store = useMissionStore
const state = () => store.getState()

beforeEach(() => store.setState(initialMissionState))

describe('mission clock', () => {
  it('advances by real time times the speed multiplier while playing', () => {
    state().setSpeed(60)
    state().tick(1000)
    expect(state().simTimeMs).toBe(DEMO_EPOCH_MS + 60_000)
  })

  it('holds while paused', () => {
    state().togglePlaying()
    state().tick(1000)
    expect(state().simTimeMs).toBe(DEMO_EPOCH_MS)
  })
})

describe('catalog', () => {
  it('filters by segment and searches name, COSPAR and NORAD', () => {
    state().setSegmentFilter('IND')
    expect(selectFilteredObjects(state()).every((o) => o.segment === 'IND')).toBe(true)
    state().setSegmentFilter('ALL')
    state().setSearchQuery('sl-16')
    expect(selectFilteredObjects(state()).map((o) => o.id)).toEqual(['SL16-RB'])
    state().setSearchQuery('41877')
    expect(selectFilteredObjects(state()).map((o) => o.id)).toEqual(['RSAT-2A'])
  })

  it('reports list categories for an object', () => {
    expect(rsoCategories('RSAT-2A')).toEqual(['protected'])
    expect(rsoCategories('SL16-RB')).toEqual(['uncooperative'])
  })
})

describe('conjunction selection', () => {
  it('selects the primary and defaults to the first course of action', () => {
    state().selectConjunction('CJ-001')
    expect(state()).toMatchObject({ selectedRsoId: 'RSAT-2A', activeSequenceId: 'SEQ-001-A', colaStatus: 'PLANNING' })
  })

  it('ignores sequences that belong to another conjunction', () => {
    state().selectConjunction('CJ-001')
    state().selectSequence('SEQ-002-A')
    expect(state().activeSequenceId).toBe('SEQ-001-A')
  })

  it('has no default sequence for a monitor-only conjunction', () => {
    state().selectConjunction('CJ-004')
    expect(state().activeSequenceId).toBeNull()
  })

  it('aggregates per object with the screening-radius override', () => {
    const before = selectAggregateSeverity(state(), 'RSAT-2A', 'vulnerable')!.index
    state().setScreeningRadius(1)
    expect(selectAggregateSeverity(state(), 'RSAT-2A', 'vulnerable')!.index).toBeLessThan(before)
    expect(selectAggregateSeverity(state(), 'SL16-RB', 'endangering')?.conjunctionIds).toEqual(['CJ-001'])
  })

  it('ranks the hero conjunction first', () => {
    expect(selectConjunctionsBySeverity(state())[0]!.event.id).toBe('CJ-001')
  })
})

describe('timeline scrubber', () => {
  it('clamps to the active sequence and drives display time', () => {
    state().selectConjunction('CJ-001')
    const sequence = selectActiveSequence(state())!
    state().scrubTo(0)
    expect(selectDisplayTimeMs(state())).toBe(Date.parse(sequence.steps[0].start))
    state().scrubTo(Number.MAX_SAFE_INTEGER)
    expect(selectDisplayTimeMs(state())).toBe(Date.parse(sequence.steps[4].end))
    state().scrubTo(null)
    expect(selectDisplayTimeMs(state())).toBe(state().simTimeMs)
  })

  it('makes the severity index respond to scrubbing towards TCA', () => {
    state().selectConjunction('CJ-001')
    const sequence = sequenceById.get('SEQ-001-A')!
    const hero = selectConjunctionsBySeverity(state())[0]!.event
    const now = selectSeverity(state(), hero).index
    state().scrubTo(Date.parse(sequence.steps[1].start))
    expect(selectSeverity(state(), hero).index).toBeGreaterThan(now)
  })
})

describe('manoeuvre envelope editor', () => {
  it('overrides the catalog envelope and resets cleanly', () => {
    state().setEnvelopeOverride('RSAT-2A', { deltaVRemainingMps: 0.5 })
    expect(selectEffectiveEnvelope(state(), 'RSAT-2A')).toMatchObject({ deltaVRemainingMps: 0.5, thrustN: 11 })
    state().resetEnvelope('RSAT-2A')
    expect(selectEffectiveEnvelope(state(), 'RSAT-2A')?.deltaVRemainingMps).toBe(18.4)
  })

  it('marks plans infeasible once the delta-v budget is too small', () => {
    const rapid = sequenceById.get('SEQ-001-B')!
    expect(selectSequenceFeasibility(state(), rapid)?.feasible).toBe(true)
    state().setEnvelopeOverride('RSAT-2A', { deltaVRemainingMps: 0.5 })
    expect(selectSequenceFeasibility(state(), rapid)).toMatchObject({ feasible: false })
    expect(selectSequenceFeasibility(state(), sequenceById.get('SEQ-001-A')!)?.feasible).toBe(true)
  })

  it('lowers the proximity term when the screening radius shrinks', () => {
    const hero = selectConjunctionsBySeverity(state())[0]!.event
    const wide = selectSeverity(state(), hero).terms.proximity.score
    state().setScreeningRadius(1)
    expect(selectSeverity(state(), hero).terms.proximity.score).toBeLessThan(wide)
  })
})

describe('camera follow', () => {
  it('toggles and resets with the demo', () => {
    state().toggleFollow()
    expect(state().followSelected).toBe(true)
    state().resetDemo()
    expect(state().followSelected).toBe(false)
  })
})

describe('COLA response', () => {
  it('commits only with an active plan and reopens planning on a new selection', () => {
    state().commitCola()
    expect(state().colaStatus).toBe('PLANNING')
    state().selectConjunction('CJ-001')
    state().commitCola()
    expect(state().colaStatus).toBe('COMMITTED')
    state().selectSequence('SEQ-001-B')
    expect(state().colaStatus).toBe('PLANNING')
  })
})
