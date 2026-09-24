// Domain contracts for Orbital Rakshak.
//
// Mapping from Solstice OS concepts:
//   Owned / Allied / Opposed lists  -> the same three RSO list categories
//   Threat window                   -> ThreatWindow (intercept); ConjunctionEvent is the separate collision screen
//   Two-burn manoeuvre sequence     -> ManeuverSequence (COLA course of action)
//   Threat rating (cheap/quick/soon) -> Conjunction Severity Index (probability/proximity/imminence)
//   Threat log                      -> SeverityLogEntry

/** ISO-8601 UTC timestamp, e.g. "2026-10-01T06:00:00Z". */
export type IsoUtc = string

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** Catalog segment, used by the sidebar filter tabs. IND = Indian protected fleet (ISRO + NGE). */
export type CatalogSegment = 'IND' | 'PAY' | 'RB' | 'DEB'

export type RcsSize = 'SMALL' | 'MEDIUM' | 'LARGE'

export type OpsStatus = 'OPERATIONAL' | 'PARTIAL' | 'NON_OPERATIONAL' | 'UNKNOWN'

export type PropulsionType = 'ELECTRIC' | 'COLD_GAS' | 'MONOPROP' | 'BIPROP' | 'NONE' | 'UNKNOWN'

/** Mean Keplerian elements at `epoch` (TLE-derived). */
export interface OrbitalElements {
  epoch: IsoUtc
  smaKm: number
  ecc: number
  incDeg: number
  raanDeg: number
  argpDeg: number
  meanAnomalyDeg: number
}

/** Spacecraft dynamics used by the Maneuver Envelope Editor. Null for non-manoeuvrable objects. */
export interface ManeuverEnvelope {
  deltaVBudgetMps: number
  deltaVRemainingMps: number
  thrustN: number
  ispS: number
  massKg: number
  propulsion: PropulsionType
}

export interface RSOObject {
  id: string
  name: string
  noradId: number
  cosparId: string
  segment: CatalogSegment
  country: string
  operator: string | null
  rcs: RcsSize
  launchDate: IsoUtc | null
  launchSite: string | null
  opsStatus: OpsStatus
  tleAgeHours: number
  elements: OrbitalElements
  envelope: ManeuverEnvelope | null
}

/** Operational meaning of a list; drives which pairs get screened. */
export type RsoListCategory = 'owned' | 'allied' | 'opposed'

export interface RSOList {
  id: string
  name: string
  category: RsoListCategory
  scope: ListScope
  memberIds: string[]
}

// ---------------------------------------------------------------------------
// Conjunctions
// ---------------------------------------------------------------------------

/** 1-sigma combined position uncertainty at TCA in the RIC frame. */
export interface RicCovariance {
  radialM: number
  inTrackM: number
  crossTrackM: number
}

/** Relative miss vector at TCA in the RIC frame of the primary. */
export interface RicMiss {
  radialM: number
  inTrackM: number
  crossTrackM: number
}

export interface ConjunctionEvent {
  id: string
  /** Owned asset. */
  primaryId: string
  /** Opposed object. */
  secondaryId: string
  tca: IsoUtc
  /** Decision window: from the first screening alert until the pair has cleared after TCA. */
  windowStart: IsoUtc
  windowEnd: IsoUtc
  missDistanceM: number
  missVector: RicMiss
  pc: number
  relativeVelocityKmS: number
  covariance: RicCovariance
  screeningRadiusKm: number
  /** Screening assessment history, oldest first. Drives the severity log. */
  assessments: ConjunctionAssessment[]
  sequenceIds: string[]
  reasoning: string | null
}

/** One screening run against a fresh ephemeris / TLE. */
export interface ConjunctionAssessment {
  assessedAt: IsoUtc
  missDistanceM: number
  pc: number
  tca: IsoUtc
}

// ---------------------------------------------------------------------------
// COLA manoeuvre sequences
// ---------------------------------------------------------------------------

export type ManeuverPhase =
  | 'COAST_MEAN_PRE'
  | 'BURN_1'
  | 'COAST_EPHEMERIS'
  | 'BURN_2'
  | 'COAST_MEAN_POST'

export type Propagator = 'SGP4' | 'NUMERICAL'

/** Unit thrust direction in the RIC frame. */
export interface RicDirection {
  radial: number
  inTrack: number
  crossTrack: number
}

export interface ManeuverStep {
  phase: ManeuverPhase
  label: string
  start: IsoUtc
  end: IsoUtc
  propagator: Propagator
  /** Zero for coast phases. */
  deltaVMps: number
  direction: RicDirection | null
}

export type ColaStrategy = 'OPTIMAL_FUEL' | 'RAPID_CLEARANCE' | 'BALANCED'

export interface ManeuverSequence {
  id: string
  conjunctionId: string
  strategy: ColaStrategy
  name: string
  summary: string
  transferType: 'PHASING' | 'RADIAL' | 'LAMBERT'
  totalDeltaVMps: number
  /** Predicted geometry at TCA after executing the plan. */
  postMissDistanceM: number
  postPc: number
  steps: [ManeuverStep, ManeuverStep, ManeuverStep, ManeuverStep, ManeuverStep]
}

// ---------------------------------------------------------------------------
// Conjunction Severity Index
// ---------------------------------------------------------------------------

export type SeverityBand = 'green' | 'blue' | 'yellow' | 'orange' | 'red'

export type SeverityFactor = 'probability' | 'proximity' | 'imminence'

/** Tunables recorded alongside every rating, mirroring the Solstice rating config. */
export interface SeverityConfig {
  base: Record<SeverityFactor, number>
  weights: Record<SeverityFactor, number>
  /** Pc at or below this scores the base; at or above pcCeiling scores 100. Log-scaled between. */
  pcFloor: number
  pcCeiling: number
  projectionPeriodHours: number
}

export interface SeverityTerm {
  factor: SeverityFactor
  /** Term score, 0-100. */
  score: number
  /** Weighted share of the final index; contributions sum to `index`. */
  contribution: number
}

export interface SeverityBreakdown {
  /** Conjunction Severity Index, 0-100. */
  index: number
  band: SeverityBand
  terms: Record<SeverityFactor, SeverityTerm>
  strongest: SeverityFactor
  evaluatedAt: IsoUtc
}

export interface SeverityLogEntry {
  objectId: string
  /** Owned assets are "vulnerable"; opposed objects are "endangering". */
  role: 'vulnerable' | 'endangering'
  assessedAt: IsoUtc
  previousIndex: number | null
  index: number
  contributingConjunctionIds: string[]
  config: SeverityConfig
}

// ---------------------------------------------------------------------------
// Threat windows (rendezvous / proximity operations)
// ---------------------------------------------------------------------------

/**
 * A precomputed two-burn phasing transfer that takes an opposed object from its own orbit to
 * a short standoff behind the target. Burn 1 enters the phasing orbit, Burn 2 matches the
 * target's orbit; the final coast is the chaser holding station.
 */
export interface InterceptSequence {
  id: string
  windowId: string
  name: string
  totalDeltaVMps: number
  /** Range to the target after Burn 2, from the propagator. */
  standoffKm: number
  steps: [ManeuverStep, ManeuverStep, ManeuverStep, ManeuverStep, ManeuverStep]
}

/**
 * Period during which an opposed object can reach an owned or allied target. Only shown once
 * the target sits in an owned or allied list and the chaser sits in an opposed list.
 */
export interface ThreatWindow {
  id: string
  /** Owned or allied object that could be approached. */
  targetId: string
  /** Opposed object able to manoeuvre onto it. */
  opposedId: string
  /** Earliest Burn 1 across the window's sequences. */
  start: IsoUtc
  /** Latest arrival across the window's sequences. */
  end: IsoUtc
  transferType: 'PHASING' | 'LAMBERT'
  reasoning: string | null
  sequenceIds: string[]
}

export type ThreatFactor = 'cheap' | 'quick' | 'soon'

/** Tunables recorded with every rating, as in the Solstice rating config. */
export interface ThreatConfig {
  base: Record<ThreatFactor, number>
  weights: Record<ThreatFactor, number>
  deltaVLimitMps: number
  projectionPeriodHours: number
}

export interface ThreatTerm {
  factor: ThreatFactor
  score: number
  /** Weighted share of the rating; contributions sum to `rating`. */
  contribution: number
}

export interface ThreatRating {
  /** 0-100 window threat rating. */
  rating: number
  band: SeverityBand
  terms: Record<ThreatFactor, ThreatTerm>
  strongest: ThreatFactor
  cheapestDeltaVMps: number
  quickestTransitS: number
  soonestArrivalMs: number
}

/** Owned and allied objects are "threatened"; opposed objects are "threatening". */
export type ThreatRole = 'threatened' | 'threatening'

/** Which lists a rating is drawn from: the organisation's, or the analyst's own. */
export type ListScope = 'ORG' | 'USER'

export type ThreatLogReason = 'MEMBER_ADDED' | 'MEMBER_REMOVED' | 'REASSESSED'

export interface ThreatLogEntry {
  id: string
  objectId: string
  role: ThreatRole
  reason: ThreatLogReason
  recordedAt: IsoUtc
  /** Null when this is the object's first recorded rating. */
  previous: number | null
  /** Null once no window rates the object. */
  rating: number | null
  /** Windows behind the rating, worst first. */
  contributors: { windowId: string; rating: number }[]
  config: ThreatConfig
}

// ---------------------------------------------------------------------------
// IN-SPACe compliance (Module M8)
// ---------------------------------------------------------------------------

export type ComplianceFormat = 'CCSDS_OEM' | 'CCSDS_OCM'

export interface ComplianceCheck {
  id: string
  label: string
  passed: boolean
  detail: string
}

export interface ComplianceReport {
  id: string
  generatedAt: IsoUtc
  format: ComplianceFormat
  operator: string
  assetId: string
  conjunctionId: string
  sequenceId: string
  authorizationRef: string
  status: 'DRAFT' | 'READY' | 'SUBMITTED'
  checks: ComplianceCheck[]
  /** Rendered OEM/OCM text body. */
  body: string
}
