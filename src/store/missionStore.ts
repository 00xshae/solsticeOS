// Single store for the demo: mission clock, catalog selection, active conjunction,
// timeline scrubber, manoeuvre-envelope overrides and the COLA response.
//
// Selectors below are plain functions of state. Ones that build new arrays or objects
// should be wrapped with useShallow or useMemo in components.
import { create } from 'zustand'
import { conjunctionById, conjunctions, DEMO_EPOCH_MS, rsoById, rsoLists, rsoObjects, sequenceById } from '@/data'
import { aggregateSeverity, computeSeverity } from '@/lib/severity'
import { categoriesOf } from '@/lib/threatScreen'
import type {
  ConjunctionEvent,
  ListScope,
  ManeuverEnvelope,
  ManeuverSequence,
  RSOList,
  RSOObject,
  RsoListCategory,
  SeverityBreakdown,
} from '@/types'

export type SpeedMultiplier = 1 | 10 | 60
export type ColaStatus = 'PLANNING' | 'COMMITTED'
export type AppView = 'globe' | 'lists'

export interface NewListInput {
  name: string
  category: RsoListCategory
  scope: ListScope
}

export interface MissionState {
  simTimeMs: number
  playing: boolean
  speed: SpeedMultiplier

  view: AppView
  /** RSO list open on the lists page; null shows the saved-watchlists table. */
  openListId: string | null
  /** Seeded org lists plus any the analyst creates; edits last for the session. */
  lists: RSOList[]

  searchQuery: string
  /** Objects the analyst has added from search: listed in the sidebar and drawn on the globe. */
  trackedIds: string[]
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
  /** Mission-clock time the active plan was committed; null while planning. */
  committedAtMs: number | null
  complianceOpen: boolean
}

export interface MissionActions {
  tick: (realElapsedMs: number) => void
  togglePlaying: () => void
  setSpeed: (speed: SpeedMultiplier) => void

  setView: (view: AppView) => void
  openList: (id: string | null) => void
  /** Returns the new list's id. */
  createList: (input: NewListInput) => string
  renameList: (id: string, name: string) => void
  deleteList: (id: string) => void
  addListMember: (listId: string, rsoId: string) => void
  removeListMember: (listId: string, rsoId: string) => void

  setSearchQuery: (query: string) => void
  trackRso: (id: string) => void
  untrackRso: (id: string) => void
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
  view: 'globe',
  openListId: null,
  lists: rsoLists,
  searchQuery: '',
  trackedIds: [],
  selectedRsoId: null,
  activeConjunctionId: null,
  activeSequenceId: null,
  scrubTimeMs: null,
  envelopeOverrides: {},
  screeningRadiusOverrideKm: null,
  followSelected: false,
  colaStatus: 'PLANNING',
  committedAtMs: null,
  complianceOpen: false,
}

const withTracked = (ids: string[], id: string) => (ids.includes(id) || !rsoById.has(id) ? ids : [...ids, id])

let listCounter = 0

const updateList = (lists: RSOList[], id: string, patch: (l: RSOList) => Partial<RSOList>) =>
  lists.map((l) => (l.id === id ? { ...l, ...patch(l) } : l))

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

  setView: (view) => set({ view }),
  openList: (openListId) => set({ openListId, view: 'lists' }),
  createList: ({ name, category, scope }) => {
    const id = `LST-NEW-${++listCounter}`
    set((s) => ({ lists: [...s.lists, { id, name: name.trim().toUpperCase(), category, scope, memberIds: [] }] }))
    return id
  },
  renameList: (id, name) => {
    if (name.trim()) set((s) => ({ lists: updateList(s.lists, id, () => ({ name: name.trim().toUpperCase() })) }))
  },
  // Only the analyst's own lists can be deleted; org lists are managed elsewhere.
  deleteList: (id) =>
    set((s) => {
      if (s.lists.find((l) => l.id === id)?.scope !== 'USER') return {}
      return { lists: s.lists.filter((l) => l.id !== id), ...(s.openListId === id && { openListId: null }) }
    }),
  addListMember: (listId, rsoId) => {
    if (!rsoById.has(rsoId)) return
    set((s) => ({
      lists: updateList(s.lists, listId, (l) => ({ memberIds: l.memberIds.includes(rsoId) ? l.memberIds : [...l.memberIds, rsoId] })),
    }))
  },
  removeListMember: (listId, rsoId) =>
    set((s) => ({ lists: updateList(s.lists, listId, (l) => ({ memberIds: l.memberIds.filter((m) => m !== rsoId) })) })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  trackRso: (id) => set((s) => ({ trackedIds: withTracked(s.trackedIds, id) })),
  untrackRso: (id) =>
    set((s) => {
      const conj = selectActiveConjunction(s)
      // Dropping either object of the open conjunction closes it: the globe can no longer show the pair.
      const closesConjunction = conj !== null && (conj.primaryId === id || conj.secondaryId === id)
      return {
        trackedIds: s.trackedIds.filter((t) => t !== id),
        ...(s.selectedRsoId === id && { selectedRsoId: null }),
        ...(closesConjunction && {
          activeConjunctionId: null,
          activeSequenceId: null,
          scrubTimeMs: null,
          colaStatus: 'PLANNING' as const,
          committedAtMs: null,
        }),
      }
    }),
  // Selecting an object always puts it on the globe.
  selectRso: (id) => set((s) => ({ selectedRsoId: id, ...(id && { trackedIds: withTracked(s.trackedIds, id) }) })),

  selectConjunction: (id) => {
    const event = id ? conjunctionById.get(id) : undefined
    set({
      activeConjunctionId: event?.id ?? null,
      // Default to the first course of action (Optimal Fuel) so the timeline has something to show.
      activeSequenceId: event?.sequenceIds[0] ?? null,
      scrubTimeMs: null,
      colaStatus: 'PLANNING',
      committedAtMs: null,
      ...(event && {
        selectedRsoId: event.primaryId,
        // Opening a conjunction puts both objects on the globe.
        trackedIds: withTracked(withTracked(get().trackedIds, event.primaryId), event.secondaryId),
      }),
    })
  },
  selectSequence: (id) => {
    const sequence = sequenceById.get(id)
    if (!sequence || sequence.conjunctionId !== get().activeConjunctionId) return
    set({ activeSequenceId: id, scrubTimeMs: null, colaStatus: 'PLANNING', committedAtMs: null })
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
    const { activeSequenceId, simTimeMs } = get()
    if (activeSequenceId) set({ colaStatus: 'COMMITTED', committedAtMs: simTimeMs })
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

/** Catalog matches for the search box; nothing until the analyst types. */
export function selectSearchResults(s: MissionState): RSOObject[] {
  const query = s.searchQuery.trim().toLowerCase()
  if (!query) return []
  return rsoObjects.filter(
    (o) =>
      o.name.toLowerCase().includes(query) ||
      o.cosparId.toLowerCase().includes(query) ||
      String(o.noradId).includes(query),
  )
}

export function selectTrackedObjects(s: MissionState): RSOObject[] {
  return s.trackedIds.flatMap((id) => rsoById.get(id) ?? [])
}

/** List categories an object belongs to, in owned / allied / opposed order. */
export const selectCategories = (s: MissionState, id: string): RsoListCategory[] => {
  const categories = categoriesOf(s.lists, id)
  return (['owned', 'allied', 'opposed'] as const).filter((c) => categories.has(c))
}

export const selectOpenList = (s: MissionState): RSOList | null => s.lists.find((l) => l.id === s.openListId) ?? null

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
