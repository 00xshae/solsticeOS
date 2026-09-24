// Generates the threat-window scenarios: adds the scenario objects to the catalog, places each
// chaser behind its target, and solves a grid of two-burn phasing intercepts.
//
// Model (same first-order one the globe uses, see src/lib/maneuver.ts): in-track burns change
// only the semi-major axis, da = 2 a dv / v. The chaser starts coplanar with its target, lower
// by `dropKm` and `phaseDeg` behind. Burn 1 moves it onto a phasing orbit at `phasingDropKm`
// below the target; the gap then closes at the differential mean motion. Burn 2, timed when
// the gap is down to the standoff, matches the target's semi-major axis. Each sequence is then
// re-flown exactly as the app will fly it (rounded delta-v, J2 secular drift) to record the
// standoff range actually achieved.
//
// Run: node scripts/generate-threats.ts   (Node 24+, native TypeScript type stripping)
import { readFileSync, writeFileSync } from 'node:fs'
import type { InterceptSequence, ManeuverStep, OrbitalElements, RSOObject, ThreatWindow } from '../src/types/index.ts'
import { circularSpeedKmS, elementsAt, j2Rates, propagateEci } from '../src/lib/orbit.ts'

const CATALOG = 'src/data/catalog.json'
const THREATS = 'src/data/threats.json'
const DEG = Math.PI / 180
const HOUR = 3_600_000

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
const EPOCH = Date.parse(catalog.demoEpoch)
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z')
const round = (x: number, dp: number) => Number(x.toFixed(dp))
const wrapDeg = (deg: number) => ((deg % 360) + 360) % 360

// ---------------------------------------------------------------------------
// Scenario objects
// ---------------------------------------------------------------------------

const circular = (smaKm: number, incDeg: number, raanDeg: number, argpDeg: number, meanAnomalyDeg: number): OrbitalElements => ({
  epoch: iso(EPOCH),
  smaKm,
  ecc: 0.0008,
  incDeg,
  raanDeg,
  argpDeg,
  meanAnomalyDeg,
})

const NEW_TARGETS: RSOObject[] = [
  {
    id: 'RISAT-2B',
    name: 'RISAT-2B',
    noradId: 44233,
    cosparId: '2019-028A',
    segment: 'IND',
    country: 'IND',
    operator: 'ISRO',
    rcs: 'MEDIUM',
    launchDate: '2019-05-22T00:00:00Z',
    launchSite: 'SDSC-SHAR',
    opsStatus: 'OPERATIONAL',
    tleAgeHours: 5,
    elements: circular(6935.4, 37.0, 212.6, 90.0, 318.4),
    envelope: { deltaVBudgetMps: 60, deltaVRemainingMps: 31, thrustN: 11, ispS: 220, massKg: 615, propulsion: 'MONOPROP' },
  },
  {
    id: 'SDX02',
    name: 'SPADEX TARGET (SDX02)',
    noradId: 62788,
    cosparId: '2024-251B',
    segment: 'IND',
    country: 'IND',
    operator: 'ISRO',
    rcs: 'SMALL',
    launchDate: '2024-12-30T16:30:00Z',
    launchSite: 'SDSC-SHAR',
    opsStatus: 'OPERATIONAL',
    tleAgeHours: 3,
    elements: circular(6853.1, 55.0, 48.2, 90.0, 204.7),
    envelope: { deltaVBudgetMps: 40, deltaVRemainingMps: 22, thrustN: 4, ispS: 210, massKg: 220, propulsion: 'MONOPROP' },
  },
]

interface ChaserSpec {
  object: Omit<RSOObject, 'elements'>
  targetId: string
  /** Chaser altitude below the target at the demo epoch. */
  dropKm: number
  /** How far behind the target the chaser trails at the demo epoch. */
  phaseDeg: number
  /** Phasing-orbit depths below the target to offer; deeper closes faster for more delta-v. */
  phasingDropsKm: number[]
  /** Burn 1 offsets from the demo epoch, hours. */
  burn1Hours: number[]
  standoffKm: number
  windowId: string
  reasoning: string
}

const inspector = (id: string, name: string, noradId: number, cosparId: string): Omit<RSOObject, 'elements'> => ({
  id,
  name,
  noradId,
  cosparId,
  segment: 'PAY',
  country: 'UNK',
  operator: null,
  rcs: 'SMALL',
  launchDate: null,
  launchSite: null,
  opsStatus: 'UNKNOWN',
  tleAgeHours: 11,
  envelope: { deltaVBudgetMps: 320, deltaVRemainingMps: 245, thrustN: 10, ispS: 220, massKg: 450, propulsion: 'MONOPROP' },
})

const every = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)

const CHASERS: ChaserSpec[] = [
  {
    object: inspector('INSP-1', 'INSPECTOR-1 (CARTOSAT-3 SHADOW)', 90011, 'SIM-2026-001'),
    targetId: 'CARTOSAT-3',
    dropKm: 6,
    phaseDeg: 22,
    phasingDropsKm: [3, 12, 21],
    burn1Hours: every(1, 46, 1.5),
    standoffKm: 2,
    windowId: 'TW-CARTOSAT-INSP1',
    reasoning:
      'Simulated inspector co-planar with CARTOSAT-3, 6 km lower and 22° behind. A two-burn phasing ' +
      'transfer brings it to a 2 km standoff for close-range imaging of the asset.',
  },
  {
    object: inspector('INSP-2', 'INSPECTOR-2 (RISAT-2B SHADOW)', 90012, 'SIM-2026-002'),
    targetId: 'RISAT-2B',
    dropKm: 3,
    phaseDeg: 25,
    phasingDropsKm: [4, 5, 6],
    burn1Hours: every(1, 46, 1.5),
    standoffKm: 2,
    windowId: 'TW-RISAT2B-INSP2',
    reasoning:
      'Simulated inspector in RISAT-2B\'s plane, 3 km lower and 25° behind. Not on any opposed list ' +
      'yet: add it to one to have Orbital Rakshak screen the pair.',
  },
  {
    object: {
      id: 'SDX01',
      name: 'SPADEX CHASER (SDX01)',
      noradId: 62787,
      cosparId: '2024-251A',
      segment: 'IND',
      country: 'IND',
      operator: 'ISRO',
      rcs: 'SMALL',
      launchDate: '2024-12-30T16:30:00Z',
      launchSite: 'SDSC-SHAR',
      opsStatus: 'OPERATIONAL',
      tleAgeHours: 3,
      envelope: { deltaVBudgetMps: 40, deltaVRemainingMps: 24, thrustN: 4, ispS: 210, massKg: 220, propulsion: 'MONOPROP' },
    },
    targetId: 'SDX02',
    dropKm: 2,
    phaseDeg: 24,
    phasingDropsKm: [2.5, 2.75, 3],
    burn1Hours: every(1, 46, 1.5),
    standoffKm: 1,
    windowId: 'TW-SPADEX',
    reasoning:
      'Indian ↔ Indian: ISRO\'s SPADEX chaser trailing its target by 24°. Placed on an opposed list for ' +
      'the demo to show that any proximity-capable object is screened, including our own fleet.',
  },
]

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

const allObjects: RSOObject[] = [
  ...catalog.objects.filter((o: RSOObject) => ![...NEW_TARGETS, ...CHASERS.map((c) => c.object)].some((n) => n.id === o.id)),
  ...NEW_TARGETS,
]
const byId = (id: string) => allObjects.find((o) => o.id === id)!

/** Mean argument of latitude in radians. */
const argLat = (el: OrbitalElements, t: number) => {
  const at = elementsAt(el, t)
  return (at.argpDeg + at.meanAnomalyDeg) * DEG
}
const argLatRate = (el: OrbitalElements) => {
  const r = j2Rates(el)
  return r.argp + r.mean
}
/** Phase of chaser relative to target in (-2π, 0]: negative means behind. */
const phaseBehind = (chaser: OrbitalElements, target: OrbitalElements, t: number) => {
  let d = (argLat(chaser, t) - argLat(target, t)) % (2 * Math.PI)
  if (d > 0) d -= 2 * Math.PI
  return d
}

/** In-track delta-v (m/s) that moves a circular orbit's SMA from `fromKm` to `toKm`. */
const deltaVFor = (fromKm: number, toKm: number) => ((toKm - fromKm) * circularSpeedKmS(fromKm) * 1000) / (2 * fromKm)
const applyBurn = (el: OrbitalElements, signedDvMps: number): OrbitalElements => ({
  ...el,
  smaKm: el.smaKm + (2 * el.smaKm * (signedDvMps / 1000)) / circularSpeedKmS(el.smaKm),
})

const burnDurationMs = (dvMps: number, spec: ChaserSpec) => {
  const env = spec.object.envelope!
  return Math.max(20_000, Math.round(((dvMps * env.massKg) / env.thrustN) * 1000 / 1000) * 1000)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function solveSequence(spec: ChaserSpec, chaser: OrbitalElements, target: OrbitalElements, index: number, burn1Ms: number, phasingDropKm: number) {
  const aT = target.smaKm
  const aX = aT - phasingDropKm
  const dv1 = round(deltaVFor(chaser.smaKm, aX), 3)
  const onPhasing = applyBurn(elementsAt(chaser, burn1Ms), dv1)
  const dv2 = round(deltaVFor(onPhasing.smaKm, aT), 3)

  // The gap closes linearly in this model; time Burn 2 for the standoff.
  const standoffRad = spec.standoffKm / aT
  const gap = phaseBehind(onPhasing, target, burn1Ms)
  const closingRate = argLatRate(onPhasing) - argLatRate(target)
  if (closingRate <= 0 || gap > -standoffRad) return null
  const burn2Ms = Math.round((burn1Ms + ((-standoffRad - gap) / closingRate) * 1000) / 1000) * 1000
  if (burn2Ms - burn1Ms > 7 * 24 * HOUR) return null

  const b1Dur = burnDurationMs(Math.abs(dv1), spec)
  const b2Dur = burnDurationMs(Math.abs(dv2), spec)
  const direction = (dv: number) => ({ radial: 0, inTrack: Math.sign(dv), crossTrack: 0 })
  const step = (phase: ManeuverStep['phase'], label: string, start: number, end: number, dv = 0, propagator: ManeuverStep['propagator'] = 'SGP4'): ManeuverStep => ({
    phase,
    label,
    start: iso(start),
    end: iso(end),
    propagator,
    deltaVMps: Math.abs(dv),
    direction: dv ? direction(dv) : null,
  })

  // Re-fly as the app does: burns applied impulsively at their start.
  const flown = applyBurn(elementsAt(onPhasing, burn2Ms), dv2)
  const settle = burn2Ms + b2Dur + 10 * 60_000
  const rc = propagateEci(flown, settle)
  const rt = propagateEci(target, settle)
  const standoffKm = Math.hypot(rc.x - rt.x, rc.y - rt.y, rc.z - rt.z)

  const id = `${spec.windowId}-S${pad2(index + 1)}`
  const sequence: InterceptSequence = {
    id,
    windowId: spec.windowId,
    name: `Phasing −${phasingDropKm} km`,
    totalDeltaVMps: round(Math.abs(dv1) + Math.abs(dv2), 2),
    standoffKm: round(standoffKm, 2),
    steps: [
      step('COAST_MEAN_PRE', 'Coast (mean elem.)', Math.min(EPOCH, burn1Ms - 6 * HOUR), burn1Ms),
      step('BURN_1', 'Burn 1', burn1Ms, burn1Ms + b1Dur, dv1, 'NUMERICAL'),
      step('COAST_EPHEMERIS', 'Coast (phasing)', burn1Ms + b1Dur, burn2Ms, 0, 'NUMERICAL'),
      step('BURN_2', 'Burn 2', burn2Ms, burn2Ms + b2Dur, dv2, 'NUMERICAL'),
      step('COAST_MEAN_POST', 'Station-keeping', burn2Ms + b2Dur, burn2Ms + b2Dur + 6 * HOUR),
    ],
  }
  return sequence
}

const chasers: RSOObject[] = []
const windows: ThreatWindow[] = []
const sequences: InterceptSequence[] = []

const signedDeg = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

/**
 * The lower chaser's node and perigee precess faster than the target's under J2. The drift
 * accumulated by arrival is proportional to the phase closed, which every sequence closes
 * equally, so one initial bias of RAAN and argument of perigee cancels it for all of them.
 */
function biasedChaser(spec: ChaserSpec, target: OrbitalElements): OrbitalElements {
  const bias = { raan: 0, argp: 0 }
  let chaser = target
  for (let i = 0; i < 4; i++) {
    const argp = target.argpDeg + bias.argp
    chaser = {
      ...target,
      epoch: iso(EPOCH),
      smaKm: round(target.smaKm - spec.dropKm, 3),
      raanDeg: round(wrapDeg(target.raanDeg + bias.raan), 5),
      argpDeg: round(wrapDeg(argp), 5),
      // Keep the argument of latitude `phaseDeg` behind whatever the perigee bias is.
      meanAnomalyDeg: round(wrapDeg(target.argpDeg + target.meanAnomalyDeg - spec.phaseDeg - argp), 5),
    }
    const reference = solveSequence(spec, chaser, target, 0, EPOCH + HOUR, spec.phasingDropsKm.at(-1)!)
    if (!reference) throw new Error(`${spec.windowId}: no reference sequence`)
    const b2 = Date.parse(reference.steps[3].start)
    const at = elementsAt(target, b2)
    // Measure the drift on the phasing orbit, where the chaser spends the transit.
    const [, burn1] = reference.steps
    const phasing = elementsAt(applyBurn(elementsAt(chaser, Date.parse(burn1.start)), burn1.deltaVMps * Math.sign(burn1.direction!.inTrack)), b2)
    bias.raan -= signedDeg(phasing.raanDeg - at.raanDeg)
    bias.argp -= signedDeg(phasing.argpDeg - at.argpDeg)
  }
  return chaser
}

for (const spec of CHASERS) {
  const target = elementsAt(byId(spec.targetId).elements, EPOCH)
  const chaserElements = biasedChaser(spec, target)
  chasers.push({ ...spec.object, elements: chaserElements })

  const solved: InterceptSequence[] = []
  for (const hours of spec.burn1Hours) {
    // Stagger burns off the hour so times read like real planning output.
    const burn1Ms = EPOCH + Math.round(hours * HOUR) + ((solved.length * 7) % 50) * 60_000
    for (const drop of spec.phasingDropsKm) {
      const s = solveSequence(spec, chaserElements, target, solved.length, burn1Ms, drop)
      if (s) solved.push(s)
    }
  }
  const starts = solved.map((s) => Date.parse(s.steps[1].start))
  const ends = solved.map((s) => Date.parse(s.steps[3].end))
  windows.push({
    id: spec.windowId,
    targetId: spec.targetId,
    opposedId: spec.object.id,
    start: iso(Math.min(...starts)),
    end: iso(Math.max(...ends)),
    transferType: 'PHASING',
    reasoning: spec.reasoning,
    sequenceIds: solved.map((s) => s.id),
  })
  sequences.push(...solved)

  const worst = Math.max(...solved.map((s) => s.standoffKm))
  const dvs = solved.map((s) => s.totalDeltaVMps)
  const transits = solved.map((s) => (Date.parse(s.steps[3].start) - Date.parse(s.steps[1].start)) / HOUR)
  console.log(
    `${spec.windowId}: ${solved.length} sequences, dv ${Math.min(...dvs)}-${Math.max(...dvs)} m/s, ` +
      `transit ${Math.min(...transits).toFixed(1)}-${Math.max(...transits).toFixed(1)} h, worst standoff ${worst} km`,
  )
}

// Lists: Cartosat-3 and SPADEX start screened; INSPECTOR-2 is left off every opposed list so the
// demo can add it live and watch the RISAT-2B window appear.
interface ListJson { id: string; name: string; category: string; scope: string; memberIds: string[] }
const lists = catalog.lists as ListJson[]
const addMembers = (listId: string, ids: string[]) => {
  const list = lists.find((l) => l.id === listId)!
  list.memberIds = [...new Set([...list.memberIds, ...ids])]
}
addMembers('LST-IND', ['RISAT-2B', 'SDX02'])
addMembers('LST-UNCOOP', ['INSP-1'])
const upsertList = (list: ListJson) => {
  const i = lists.findIndex((l) => l.id === list.id)
  if (i >= 0) lists[i] = list
  else lists.push(list)
}
upsertList({ id: 'LST-SPADEX-BLUE', name: 'SPADEX TARGET — BLUE (OWNED)', category: 'owned', scope: 'ORG', memberIds: ['SDX02'] })
upsertList({ id: 'LST-SPADEX-RED', name: 'SPADEX CHASER — RED (OPPOSED, DEMO)', category: 'opposed', scope: 'ORG', memberIds: ['SDX01'] })

catalog.objects = [...allObjects, ...chasers]
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n')
// One sequence per line keeps the file compact while diffs stay readable.
const header = { note: 'Generated by scripts/generate-threats.ts. Simulated scenarios.', windows }
writeFileSync(
  THREATS,
  `${JSON.stringify(header, null, 2).slice(0, -2)},\n  "sequences": [\n${sequences.map((s) => `    ${JSON.stringify(s)}`).join(',\n')}\n  ]\n}\n`,
)
