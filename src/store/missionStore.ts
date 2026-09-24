// Single store for the demo: mission clock, catalog selection, active conjunction,
// timeline scrubber, manoeuvre-envelope overrides and the COLA response.
//
// Selectors below are plain functions of state. Ones that build new arrays or objects
// should be wrapped with useShallow or useMemo in components.
import { create } from 'zustand'
import { conjunctionById, conjunctions, DEMO_EPOCH_MS, rsoById, rsoLists, rsoObjects, sequenceById } from '@/data'
import { aggregateSeverity, computeSeverity } from '@/lib/severity'
import type {
  CatalogSegment,
  ConjunctionEvent,
  ManeuverEnvelope,
  ManeuverSequence,
  RSOObject,
  RsoListCategory,
  SeverityBreakdown,
} from '@/types'

export type SpeedMultiplier = 1 | 10 | 60
export type SegmentFilter = CatalogSegment | 'ALL'
export type ColaStatus = 'PLANNING' | 'COMMITTED'

export interface MissionState {
  simTimeMs: number
  playing: boolean
  speed: SpeedMultiplier

  segmentFilter: SegmentFilter
  searchQuery: string
  selectedRsoId: string | null

  activeConjunctionId: string | null
  activeSequenceId: string | null
  /** Timeline scrubber position; null follows the mission clock. */
  scrubTimeMs: number | null

  envelopeOverrides: Record<string, Partial<ManeuverEnvelope>>
  screeningRadiusOverrideKm: number | null

  /** Keep the camera centred on the selected object as it moves. */
  followSelected: boolean

  colaStatus: ColaStatus
  complianceOpen: boolean
}

export interface MissionActions {
  tick: (realElapsedMs: number) => void
  togglePlaying: () => void
  setSpeed: (speed: SpeedMultiplier) => void

  setSegmentFilter: (filter: SegmentFilter) => void
  setSearchQuery: (query: string) => void
  selectRso: (id: string | null) => void

  selectConjunction: (id: string | null) => void
  selectSequence: (id: string) => void
  scrubTo: (timeMs: number | null) => void

  setEnvelopeOverride: (rsoId: string, patch: Partial<ManeuverEnvelope>) => void
  resetEnvelope: (rsoId: string) => void
  setScreeningRadius: (km: number | null) => void

  commitCola: () => void
  toggleFollow: () => void
  setComplianceOpen: (open: boolean) => void
  resetDemo: () => void
}

export type MissionStore = MissionState & MissionActions

export const initialMissionState: MissionState = {
  simTimeMs: DEMO_EPOCH_MS,
  playing: true,
  speed: 1,
  segmentFilter: 'ALL',
  searchQuery: '',
  selectedRsoId: null,
  activeConjunctionId: null,
  activeSequenceId: null,
  scrubTimeMs: null,
  envelopeOverrides: {},
  screeningRadiusOverrideKm: null,
  followSelected: false,
  colaStatus: 'PLANNING',
  complianceOpen: false,
}

const sequenceBounds = (sequence: ManeuverSequence): [number, number] => [
  Date.parse(sequence.steps[0].start),
  Date.parse(sequence.steps[4].end),
]

export const useMissionStore = create<MissionStore>()((set, get) => ({
  ...initialMissionState,

  tick: (realElapsedMs) => {
    const { playing, speed, simTimeMs } = get()
    if (playing) set({ simTimeMs: simTimeMs + realElapsedMs * speed })
  },
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),

  setSegmentFilter: (segmentFilter) => set({ segmentFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  selectRso: (selectedRsoId) => set({ selectedRsoId }),

  selectConjunction: (id) => {
    const event = id ? conjunctionById.get(id) : undefined
    set({
      activeConjunctionId: event?.id ?? null,
      // Default to the first course of action (Optimal Fuel) so the timeline has something to show.
      activeSequenceId: event?.sequenceIds[0] ?? null,
      scrubTimeMs: null,
      colaStatus: 'PLANNING',
      ...(event && { selectedRsoId: event.primaryId }),
    })
  },
  selectSequence: (id) => {
    const sequence = sequenceById.get(id)
    if (!sequence || sequence.conjunctionId !== get().activeConjunctionId) return
    set({ activeSequenceId: id, scrubTimeMs: null, colaStatus: 'PLANNING' })
  },
  scrubTo: (timeMs) => {
    const sequence = selectActiveSequence(get())
    if (timeMs === null || !sequence) return set({ scrubTimeMs: null })
    const [start, end] = sequenceBounds(sequence)
    set({ scrubTimeMs: Math.min(end, Math.max(start, timeMs)) })
  },

  setEnvelopeOverride: (rsoId, patch) =>
    set((s) => ({
      envelopeOverrides: { ...s.envelopeOverrides, [rsoId]: { ...s.envelopeOverrides[rsoId], ...patch } },
    })),
  resetEnvelope: (rsoId) =>
    set((s) => {
      const { [rsoId]: _removed, ...rest } = s.envelopeOverrides
      return { envelopeOverrides: rest }
    }),
  setScreeningRadius: (screeningRadiusOverrideKm) => set({ screeningRadiusOverrideKm }),

  commitCola: () => {
    if (get().activeSequenceId) set({ colaStatus: 'COMMITTED' })
  },
  toggleFollow: () => set((s) => ({ followSelected: !s.followSelected })),
  setComplianceOpen: (complianceOpen) => set({ complianceOpen }),
  resetDemo: () => set(initialMissionState),
}))

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Time the globe and panels render at: the scrubber when dragged, otherwise the mission clock. */
export const selectDisplayTimeMs = (s: MissionState) => s.scrubTimeMs ?? s.simTimeMs

export const selectSelectedRso = (s: MissionState): RSOObject | null =>
  (s.selectedRsoId && rsoById.get(s.selectedRsoId)) || null

export const selectActiveConjunction = (s: MissionState): ConjunctionEvent | null =>
  (s.activeConjunctionId && conjunctionById.get(s.activeConjunctionId)) || null

export const selectActiveSequence = (s: MissionState): ManeuverSequence | null =>
  (s.activeSequenceId && sequenceById.get(s.activeSequenceId)) || null

export function selectFilteredObjects(s: MissionState): RSOObject[] {
  const query = s.searchQuery.trim().toLowerCase()
  return rsoObjects.filter(
    (o) =>
      (s.segmentFilter === 'ALL' || o.segment === s.segmentFilter) &&
      (!query ||
        o.name.toLowerCase().includes(query) ||
        o.cosparId.toLowerCase().includes(query) ||
        String(o.noradId).includes(query)),
  )
}

const categoriesById = new Map<string, Set<RsoListCategory>>()
for (const list of rsoLists) {
  for (const id of list.memberIds) {
    const set = categoriesById.get(id) ?? new Set<RsoListCategory>()
    set.add(list.category)
    categoriesById.set(id, set)
  }
}

export const rsoCategories = (id: string): RsoListCategory[] => [...(categoriesById.get(id) ?? [])]

/** Catalog envelope with the analyst's editor overrides applied. */
export function selectEffectiveEnvelope(s: MissionState, rsoId: string): ManeuverEnvelope | null {
  const base = rsoById.get(rsoId)?.envelope
  return base ? { ...base, ...s.envelopeOverrides[rsoId] } : null
}

export const selectScreeningRadiusKm = (s: MissionState, event: ConjunctionEvent) =>
  s.screeningRadiusOverrideKm ?? event.screeningRadiusKm

export function selectSeverity(s: MissionState, event: ConjunctionEvent): SeverityBreakdown {
  return computeSeverity(
    { ...event, screeningRadiusKm: selectScreeningRadiusKm(s, event) },
    selectDisplayTimeMs(s),
  )
}

/** Worst open conjunction for an object, honouring the screening-radius override. */
export function selectAggregateSeverity(s: MissionState, objectId: string, role: 'vulnerable' | 'endangering') {
  const events = s.screeningRadiusOverrideKm === null
    ? conjunctions
    : conjunctions.map((e) => ({ ...e, screeningRadiusKm: s.screeningRadiusOverrideKm! }))
  return aggregateSeverity(objectId, role, events, selectDisplayTimeMs(s))
}

export function selectConjunctionsBySeverity(s: MissionState) {
  return conjunctions
    .map((event) => ({ event, severity: selectSeverity(s, event) }))
    .sort((a, b) => b.severity.index - a.severity.index)
}

export interface SequenceFeasibility {
  feasible: boolean
  /** Remaining delta-v after executing the plan. */
  marginMps: number
  /** Burn duration per burn at the effective thrust and mass. */
  burnDurationS: number
}

/** Re-evaluates a plan against the effective envelope, so editor sliders update the COA cards. */
export function selectSequenceFeasibility(s: MissionState, sequence: ManeuverSequence): SequenceFeasibility | null {
  const event = conjunctionById.get(sequence.conjunctionId)
  const envelope = event && selectEffectiveEnvelope(s, event.primaryId)
  if (!envelope) return null
  const perBurnMps = sequence.steps[1].deltaVMps
  const marginMps = envelope.deltaVRemainingMps - sequence.totalDeltaVMps
  return {
    feasible: marginMps >= 0 && envelope.thrustN > 0,
    marginMps,
    burnDurationS: envelope.thrustN > 0 ? (perBurnMps * envelope.massKg) / envelope.thrustN : Infinity,
  }
}
