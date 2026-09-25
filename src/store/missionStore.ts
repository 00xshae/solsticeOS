// Single store for the demo: mission clock, catalog selection, active conjunction,
// timeline scrubber, manoeuvre-envelope overrides and the COLA response.
//
// Selectors below are plain functions of state. Ones that build new arrays or objects
// should be wrapped with useShallow or useMemo in components.
import { create } from 'zustand'
import {
  conjunctionById,
  conjunctions,
  DEMO_EPOCH_MS,
  interceptSequenceById,
  rsoById,
  rsoLists,
  rsoObjects,
  sequenceById,
  sequencesOfWindow,
  threatWindowById,
} from '@/data'
import type { StepPlan } from '@/lib/maneuver'
import { aggregateSeverity, computeSeverity } from '@/lib/severity'
import { isSequenceOpen, sequenceMetrics } from '@/lib/threat'
import {
  assessThreats,
  categoriesOf,
  establishedWindows,
  isWindowEstablished,
  objectThreat,
  windowRating,
  type LoggedRatings,
} from '@/lib/threatScreen'
import type {
  ConjunctionEvent,
  InterceptSequence,
  ListScope,
  ManeuverEnvelope,
  ManeuverSequence,
  RSOList,
  RSOObject,
  RsoListCategory,
  SeverityBreakdown,
  ThreatLogEntry,
  ThreatLogReason,
  ThreatRating,
  ThreatRole,
  ThreatWindow,
} from '@/types'

export type SpeedMultiplier = 10 | 100 | 1000
export type ColaStatus = 'PLANNING' | 'COMMITTED'
export type AppView = 'globe' | 'lists' | 'response'

/** What the Threat Rating dialog explains: one window, or one object's aggregate. */
export type RatingModalTarget = { kind: 'window'; windowId: string } | { kind: 'object'; objectId: string; role: ThreatRole }

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

  /** Recorded threat ratings, newest first. */
  threatLog: ThreatLogEntry[]
  /** Last logged rating per object and role, to detect changes. */
  loggedRatings: LoggedRatings
  /** Mission-clock hour of the last scheduled reassessment. */
  lastAssessedHour: number

  searchQuery: string
  /** Objects the analyst has added from search: listed in the sidebar and drawn on the globe. */
  trackedIds: string[]
  selectedRsoId: string | null

  activeConjunctionId: string | null
  activeSequenceId: string | null
  /** Open threat window; mutually exclusive with the active conjunction. */
  activeThreatWindowId: string | null
  /** Intercept sequence the chaser flies on the globe and timeline. */
  activeInterceptId: string | null
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
  ratingModal: RatingModalTarget | null
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
  selectThreatWindow: (id: string | null) => void
  selectIntercept: (id: string) => void
  scrubTo: (timeMs: number | null) => void

  setEnvelopeOverride: (rsoId: string, patch: Partial<ManeuverEnvelope>) => void
  resetEnvelope: (rsoId: string) => void
  setScreeningRadius: (km: number | null) => void

  commitCola: () => void
  toggleFollow: () => void
  setComplianceOpen: (open: boolean) => void
  openRatingModal: (target: RatingModalTarget | null) => void
  resetDemo: () => void
}

export type MissionStore = MissionState & MissionActions

const HOUR_MS = 3_600_000
let logCounter = 0

type LogState = Pick<MissionState, 'threatLog' | 'loggedRatings'>

/** Re-rates everything at `nowMs` and prepends any resulting entries to the log. */
function withAssessment(
  s: LogState,
  lists: RSOList[],
  nowMs: number,
  reason: ThreatLogReason,
  focusIds: string[] = [],
): LogState {
  const { entries, ratings } = assessThreats(lists, s.loggedRatings, nowMs, reason, focusIds)
  const stamped = entries.map((e) => ({ ...e, id: `LOG-${++logCounter}` }))
  return { threatLog: [...stamped.reverse(), ...s.threatLog], loggedRatings: ratings }
}

/**
 * History before the demo starts: the scenario objects joined their lists two days earlier,
 * and hourly reassessments have been recording the ratings climb as the windows approach.
 */
function seedThreatLog(): LogState {
  let log: LogState = { threatLog: [], loggedRatings: {} }
  log = withAssessment(log, rsoLists, DEMO_EPOCH_MS - 48 * HOUR_MS, 'MEMBER_ADDED')
  for (const hoursBefore of [36, 24, 12, 6, 0]) {
    log = withAssessment(log, rsoLists, DEMO_EPOCH_MS - hoursBefore * HOUR_MS, 'REASSESSED')
  }
  return log
}

export const initialMissionState: MissionState = {
  simTimeMs: DEMO_EPOCH_MS,
  playing: true,
  speed: 10,
  view: 'globe',
  openListId: null,
  lists: rsoLists,
  ...seedThreatLog(),
  lastAssessedHour: Math.floor(DEMO_EPOCH_MS / HOUR_MS),
  searchQuery: '',
  trackedIds: [],
  selectedRsoId: null,
  activeConjunctionId: null,
  activeSequenceId: null,
  activeThreatWindowId: null,
  activeInterceptId: null,
  scrubTimeMs: null,
  envelopeOverrides: {},
  screeningRadiusOverrideKm: null,
  followSelected: false,
  colaStatus: 'PLANNING',
  committedAtMs: null,
  complianceOpen: false,
  ratingModal: null,
}

const withTracked = (ids: string[], id: string) => (ids.includes(id) || !rsoById.has(id) ? ids : [...ids, id])

let listCounter = 0

const updateList = (lists: RSOList[], id: string, patch: (l: RSOList) => Partial<RSOList>) =>
  lists.map((l) => (l.id === id ? { ...l, ...patch(l) } : l))

const planBounds = (plan: StepPlan): [number, number] => [
  Date.parse(plan.steps[0]!.start),
  Date.parse(plan.steps.at(-1)!.end),
]

/** Soonest-arriving sequence still open at `nowMs`, else the window's first. */
function defaultIntercept(window: ThreatWindow, nowMs: number): string | null {
  const sequences = sequencesOfWindow.get(window.id) ?? []
  const open = sequences.filter((s) => isSequenceOpen(s, nowMs))
  const soonest = open.sort((a, b) => sequenceMetrics(a).arrivalMs - sequenceMetrics(b).arrivalMs)[0]
  return (soonest ?? sequences[0])?.id ?? null
}

const CLOSED_THREAT = { activeThreatWindowId: null, activeInterceptId: null } as const
const CLOSED_CONJUNCTION = {
  activeConjunctionId: null,
  activeSequenceId: null,
  colaStatus: 'PLANNING' as ColaStatus,
  committedAtMs: null,
} as const

/** Closes the active threat window if list edits mean it is no longer screened. */
const keepThreatIfEstablished = (s: MissionState, lists: RSOList[]) => {
  const window = selectActiveThreatWindow(s)
  return window && !isWindowEstablished(lists, window) ? { ...CLOSED_THREAT, scrubTimeMs: null } : {}
}

export const useMissionStore = create<MissionStore>()((set, get) => ({
  ...initialMissionState,

  tick: (realElapsedMs) => {
    const s = get()
    if (!s.playing) return
    const simTimeMs = s.simTimeMs + realElapsedMs * s.speed
    const hour = Math.floor(simTimeMs / HOUR_MS)
    // Ratings are reassessed hourly on the mission clock, as in Solstice.
    if (hour > s.lastAssessedHour) {
      set({ simTimeMs, lastAssessedHour: hour, ...withAssessment(s, s.lists, hour * HOUR_MS, 'REASSESSED') })
    } else {
      set({ simTimeMs })
    }
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
      const list = s.lists.find((l) => l.id === id)
      if (list?.scope !== 'USER') return {}
      const lists = s.lists.filter((l) => l.id !== id)
      return {
        lists,
        ...(s.openListId === id && { openListId: null }),
        ...withAssessment(s, lists, s.simTimeMs, 'MEMBER_REMOVED', list.memberIds),
        ...keepThreatIfEstablished(s, lists),
      }
    }),
  addListMember: (listId, rsoId) =>
    set((s) => {
      const list = s.lists.find((l) => l.id === listId)
      if (!list || !rsoById.has(rsoId) || list.memberIds.includes(rsoId)) return {}
      const lists = updateList(s.lists, listId, (l) => ({ memberIds: [...l.memberIds, rsoId] }))
      return { lists, ...withAssessment(s, lists, s.simTimeMs, 'MEMBER_ADDED', [rsoId]) }
    }),
  removeListMember: (listId, rsoId) =>
    set((s) => {
      if (!s.lists.find((l) => l.id === listId)?.memberIds.includes(rsoId)) return {}
      const lists = updateList(s.lists, listId, (l) => ({ memberIds: l.memberIds.filter((m) => m !== rsoId) }))
      return {
        lists,
        ...withAssessment(s, lists, s.simTimeMs, 'MEMBER_REMOVED', [rsoId]),
        ...keepThreatIfEstablished(s, lists),
      }
    }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  trackRso: (id) => set((s) => ({ trackedIds: withTracked(s.trackedIds, id) })),
  untrackRso: (id) =>
    set((s) => {
      const conj = selectActiveConjunction(s)
      const threat = selectActiveThreatWindow(s)
      // Dropping either object of the open pair closes it: the globe can no longer show it.
      const closesConjunction = conj !== null && (conj.primaryId === id || conj.secondaryId === id)
      const closesThreat = threat !== null && (threat.targetId === id || threat.opposedId === id)
      return {
        trackedIds: s.trackedIds.filter((t) => t !== id),
        ...(s.selectedRsoId === id && { selectedRsoId: null }),
        ...(closesConjunction && { ...CLOSED_CONJUNCTION, scrubTimeMs: null }),
        ...(closesThreat && { ...CLOSED_THREAT, scrubTimeMs: null }),
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
        ...CLOSED_THREAT,
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
  selectThreatWindow: (id) => {
    const window = id ? threatWindowById.get(id) : undefined
    const s = get()
    set({
      activeThreatWindowId: window?.id ?? null,
      activeInterceptId: window ? defaultIntercept(window, selectDisplayTimeMs(s)) : null,
      scrubTimeMs: null,
      ...(window && {
        ...CLOSED_CONJUNCTION,
        selectedRsoId: window.targetId,
        // Opening a window puts the target and its chaser on the globe.
        trackedIds: withTracked(withTracked(s.trackedIds, window.targetId), window.opposedId),
      }),
    })
  },
  selectIntercept: (id) => {
    const sequence = interceptSequenceById.get(id)
    if (!sequence || sequence.windowId !== get().activeThreatWindowId) return
    set({ activeInterceptId: id, scrubTimeMs: null })
  },
  scrubTo: (timeMs) => {
    const plan = selectActivePlan(get())
    if (timeMs === null || !plan) return set({ scrubTimeMs: null })
    const [start, end] = planBounds(plan)
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
  openRatingModal: (ratingModal) => set({ ratingModal }),
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

export const selectActiveThreatWindow = (s: MissionState): ThreatWindow | null =>
  (s.activeThreatWindowId && threatWindowById.get(s.activeThreatWindowId)) || null

export const selectActiveIntercept = (s: MissionState): InterceptSequence | null =>
  (s.activeInterceptId && interceptSequenceById.get(s.activeInterceptId)) || null

/** Whatever the timeline is scrubbing: the COLA plan or the chaser's intercept. */
export const selectActivePlan = (s: MissionState): ManeuverSequence | InterceptSequence | null =>
  selectActiveSequence(s) ?? selectActiveIntercept(s)

/** Windows screened by the current lists (any scope). New array: wrap in useShallow/useMemo. */
export const selectEstablishedWindows = (s: MissionState): ThreatWindow[] => establishedWindows(s.lists)

export const selectWindowRating = (s: MissionState, window: ThreatWindow): ThreatRating | null =>
  windowRating(window, selectDisplayTimeMs(s))

export const selectObjectThreat = (s: MissionState, objectId: string, role: ThreatRole, scope?: ListScope) =>
  objectThreat(s.lists, objectId, role, selectDisplayTimeMs(s), scope)

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
