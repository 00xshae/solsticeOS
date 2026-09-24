// IN-SPACe compliance export (Module M8), demo implementation.
//
// Builds the post-manoeuvre filing for a committed COLA plan: pre-submission checks plus a
// CCSDS KVN body, either an OEM (state ephemeris of the manoeuvred trajectory) or an OCM
// (manoeuvre plan summary). Every artefact is watermarked as demo output: the layout follows
// the CCSDS keyword style, but it is not an official IN-SPACe form or reference.
import type {
  ComplianceCheck,
  ComplianceFormat,
  ComplianceReport,
  ConjunctionEvent,
  ManeuverEnvelope,
  ManeuverSequence,
  RSOObject,
} from '@/types'
import { MIN_DECISION_LEAD_MS } from './cola'
import { maneuveredElementsAt } from './maneuver'
import { propagateEci } from './orbit'

export const PC_ACTION_THRESHOLD = 1e-4
export const MIN_POST_MISS_M = 1000
export const EPHEMERIS_STEP_S = 60
const EPHEMERIS_LEAD_MS = 60 * 60_000
const EPHEMERIS_TAIL_MS = 24 * 3_600_000
const WATERMARK = 'DEMO OUTPUT - NOT AN OFFICIAL IN-SPACe SUBMISSION'
const ORIGINATOR = 'ORBITAL-RAKSHAK'

export interface ComplianceInput {
  event: ConjunctionEvent
  sequence: ManeuverSequence
  object: RSOObject
  envelope: ManeuverEnvelope | null
  nowMs: number
  format: ComplianceFormat
}

/** CCSDS epoch: 2026-10-02T07:29:00.000 (UTC, no zone suffix). */
const ccsdsTime = (ms: number) => new Date(ms).toISOString().replace('Z', '')

const fixed = (x: number, dp: number) => (x >= 0 ? ' ' : '') + x.toFixed(dp)

export function complianceChecks({ event, sequence, object, envelope, nowMs }: ComplianceInput): ComplianceCheck[] {
  const remaining = envelope?.deltaVRemainingMps ?? 0
  const leadMs = Date.parse(sequence.steps[1].start) - nowMs
  const afterPlan = maneuveredElementsAt(object.elements, sequence, Date.parse(sequence.steps[4].start))
  const smaResidualM = Math.abs(afterPlan.smaKm - object.elements.smaKm) * 1000

  return [
    {
      id: 'dv-budget',
      label: 'Δv within remaining budget',
      passed: sequence.totalDeltaVMps <= remaining,
      detail: `${sequence.totalDeltaVMps.toFixed(2)} of ${remaining.toFixed(2)} m/s remaining`,
    },
    {
      id: 'lead-time',
      label: 'Filed ahead of Burn 1',
      passed: leadMs >= MIN_DECISION_LEAD_MS,
      detail: `${(leadMs / 3_600_000).toFixed(1)} h before Burn 1 (minimum ${MIN_DECISION_LEAD_MS / 3_600_000} h)`,
    },
    {
      id: 'post-pc',
      label: 'Post-manoeuvre Pc below action threshold',
      passed: sequence.postPc < PC_ACTION_THRESHOLD,
      detail: `Pc ${sequence.postPc.toExponential(1)} vs threshold ${PC_ACTION_THRESHOLD.toExponential(0)} (pre ${event.pc.toExponential(1)})`,
    },
    {
      id: 'post-miss',
      label: 'Post-manoeuvre miss distance',
      passed: sequence.postMissDistanceM >= MIN_POST_MISS_M,
      detail: `${(sequence.postMissDistanceM / 1000).toFixed(2)} km vs ${MIN_POST_MISS_M / 1000} km minimum (pre ${event.missDistanceM} m)`,
    },
    {
      id: 'orbit-restored',
      label: 'Nominal orbit restored after Burn 2',
      passed: smaResidualM < 10,
      detail: `Semi-major axis residual ${smaResidualM.toFixed(2)} m`,
    },
  ]
}

/** Position (km) and finite-difference velocity (km/s) along the manoeuvred trajectory. */
function stateAt(object: RSOObject, sequence: ManeuverSequence, t: number) {
  const at = (ms: number) => propagateEci(maneuveredElementsAt(object.elements, sequence, ms), ms)
  const r = at(t)
  const a = at(t - 500)
  const b = at(t + 500)
  return { r, v: { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z } }
}

export function ephemerisSpan(sequence: ManeuverSequence): [number, number] {
  return [
    Date.parse(sequence.steps[1].start) - EPHEMERIS_LEAD_MS,
    Date.parse(sequence.steps[3].end) + EPHEMERIS_TAIL_MS,
  ]
}

function header(kind: 'OEM' | 'OCM', nowMs: number, id: string, authorizationRef: string) {
  return [
    kind === 'OEM' ? 'CCSDS_OEM_VERS = 2.0' : 'CCSDS_OCM_VERS = 3.0',
    `COMMENT ${WATERMARK}`,
    `COMMENT Filing ${id} · authorization ref ${authorizationRef}`,
    `CREATION_DATE = ${ccsdsTime(nowMs)}`,
    `ORIGINATOR = ${ORIGINATOR}`,
  ]
}

function renderOem(input: ComplianceInput, id: string, authorizationRef: string): string {
  const { object, sequence, nowMs } = input
  const [start, stop] = ephemerisSpan(sequence)
  const lines = [
    ...header('OEM', nowMs, id, authorizationRef),
    '',
    'META_START',
    `OBJECT_NAME = ${object.name}`,
    `OBJECT_ID = ${object.cosparId}`,
    'CENTER_NAME = EARTH',
    'REF_FRAME = TEME',
    'TIME_SYSTEM = UTC',
    `START_TIME = ${ccsdsTime(start)}`,
    `STOP_TIME = ${ccsdsTime(stop)}`,
    'META_STOP',
    '',
    `COMMENT Post-manoeuvre ephemeris for ${sequence.name} (${sequence.id}), ${EPHEMERIS_STEP_S} s step`,
    ...sequence.steps
      .filter((s) => s.deltaVMps > 0)
      .map((s) => `COMMENT ${s.label} ${ccsdsTime(Date.parse(s.start))} dV ${s.deltaVMps.toFixed(3)} m/s in-track`),
  ]
  for (let t = start; t <= stop; t += EPHEMERIS_STEP_S * 1000) {
    const { r, v } = stateAt(object, sequence, t)
    lines.push(
      [ccsdsTime(t), fixed(r.x, 6), fixed(r.y, 6), fixed(r.z, 6), fixed(v.x, 9), fixed(v.y, 9), fixed(v.z, 9)].join(' '),
    )
  }
  return lines.join('\n') + '\n'
}

function renderOcm(input: ComplianceInput, id: string, authorizationRef: string): string {
  const { object, sequence, event, envelope, nowMs } = input
  const [start, stop] = ephemerisSpan(sequence)
  const burns = sequence.steps.filter((s) => s.deltaVMps > 0)
  return [
    ...header('OCM', nowMs, id, authorizationRef),
    '',
    'META_START',
    `OBJECT_NAME = ${object.name}`,
    `INTERNATIONAL_DESIGNATOR = ${object.cosparId}`,
    `OPERATOR = ${object.operator ?? 'UNKNOWN'}`,
    'TIME_SYSTEM = UTC',
    `START_TIME = ${ccsdsTime(start)}`,
    `STOP_TIME = ${ccsdsTime(stop)}`,
    `COMMENT Conjunction ${event.id} with NORAD ${event.secondaryId}, TCA ${ccsdsTime(Date.parse(event.tca))}`,
    'META_STOP',
    '',
    'MAN_START',
    `MAN_ID = ${sequence.id}`,
    `MAN_BASIS = PLANNED`,
    `MAN_DEVICE_ID = ${envelope?.propulsion ?? 'UNKNOWN'}`,
    `MAN_PURPOSE = COLLISION_AVOIDANCE`,
    'MAN_REF_FRAME = RTN',
    'MAN_COMPOSITION = TIME_ABSOLUTE TIME_RELATIVE DV_X DV_Y DV_Z',
    'COMMENT DV in km/s; TIME_RELATIVE is burn duration in s',
    ...burns.map((s) => {
      const dir = s.direction ?? { radial: 0, inTrack: 0, crossTrack: 0 }
      const dv = s.deltaVMps / 1000
      const duration = (Date.parse(s.end) - Date.parse(s.start)) / 1000
      return [
        ccsdsTime(Date.parse(s.start)),
        duration.toFixed(1),
        fixed(dir.radial * dv, 8),
        fixed(dir.inTrack * dv, 8),
        fixed(dir.crossTrack * dv, 8),
      ].join(' ')
    }),
    'MAN_STOP',
    '',
    `COMMENT Predicted post-manoeuvre miss ${sequence.postMissDistanceM} m, Pc ${sequence.postPc.toExponential(1)}`,
  ].join('\n') + '\n'
}

export function buildComplianceReport(input: ComplianceInput): ComplianceReport {
  const { event, sequence, object, nowMs, format } = input
  const stamp = new Date(nowMs).toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const id = `OR-${sequence.id}-${stamp}`
  const authorizationRef = `DEMO-NGP-${object.noradId}-${event.id}`
  const checks = complianceChecks(input)
  return {
    id,
    generatedAt: new Date(nowMs).toISOString(),
    format,
    operator: object.operator ?? 'UNKNOWN',
    assetId: object.id,
    conjunctionId: event.id,
    sequenceId: sequence.id,
    authorizationRef,
    status: checks.every((c) => c.passed) ? 'READY' : 'DRAFT',
    checks,
    body: format === 'CCSDS_OEM' ? renderOem(input, id, authorizationRef) : renderOcm(input, id, authorizationRef),
  }
}

export const complianceFileName = (report: ComplianceReport) =>
  `${report.id}.${report.format === 'CCSDS_OEM' ? 'oem' : 'ocm'}`
