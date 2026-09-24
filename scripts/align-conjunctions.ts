// Re-fits each conjunction's secondary so the globe geometry agrees with the seeded screening:
// at TCA the secondary sits on the primary's nominal position. Keeps the secondary's
// inclination and eccentricity; solves RAAN, argument of perigee, mean anomaly and SMA.
// Of the two plane crossings, picks the one whose relative velocity is closest to the seed,
// then records the achieved relative velocity.
//
// Run: node scripts/align-conjunctions.ts   (Node 24+, native TypeScript type stripping)
import { readFileSync, writeFileSync } from 'node:fs'
import type { OrbitalElements } from '../src/types/index.ts'
import { elementsAt, propagateEci, type Vec3 } from '../src/lib/orbit.ts'

const DEG = Math.PI / 180
const CATALOG = 'src/data/catalog.json'
const CONJUNCTIONS = 'src/data/conjunctions.json'

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
const conj = JSON.parse(readFileSync(CONJUNCTIONS, 'utf8'))

const sub = (a: Vec3, b: Vec3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const norm = (v: Vec3) => Math.hypot(v.x, v.y, v.z)
const velocity = (el: OrbitalElements, t: number) => {
  const dt = 500
  const d = sub(propagateEci(el, t + dt), propagateEci(el, t - dt))
  return { x: d.x / (2 * dt / 1000), y: d.y / (2 * dt / 1000), z: d.z / (2 * dt / 1000) }
}
const round = (x: number, dp: number) => Number(x.toFixed(dp))
const wrap = (deg: number) => ((deg % 360) + 360) % 360

/** Elements at epoch `tcaMs` placing the object at `r` with argument of latitude `u`. */
function elementsThrough(r: Vec3, u: number, template: OrbitalElements, tcaMs: number): OrbitalElements {
  const inc = template.incDeg * DEG
  const e = template.ecc
  const nu = Math.PI / 2 // put TCA at 90 deg true anomaly
  const radius = norm(r)
  const raan = Math.atan2(r.y, r.x) - Math.atan2(Math.sin(u) * Math.cos(inc), Math.cos(u))
  const E = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu), e + Math.cos(nu))
  return {
    epoch: new Date(tcaMs).toISOString(),
    smaKm: radius / (1 - e * e),
    ecc: e,
    incDeg: template.incDeg,
    raanDeg: wrap(raan / DEG),
    argpDeg: wrap((u - nu) / DEG),
    meanAnomalyDeg: wrap((E - e * Math.sin(E)) / DEG),
  }
}

for (const event of conj.events) {
  const primary = catalog.objects.find((o: { id: string }) => o.id === event.primaryId)
  const secondary = catalog.objects.find((o: { id: string }) => o.id === event.secondaryId)
  const tca = Date.parse(event.tca)
  const r = propagateEci(primary.elements, tca)
  const vp = velocity(primary.elements, tca)

  const sinU = r.z / norm(r) / Math.sin(secondary.elements.incDeg * DEG)
  if (Math.abs(sinU) > 1) throw new Error(`${event.id}: primary latitude exceeds secondary inclination at TCA`)
  const u1 = Math.asin(sinU)

  const candidates = [u1, Math.PI - u1].map((u) => {
    const atTca = elementsThrough(r, u, secondary.elements, tca)
    const atEpoch = elementsAt(atTca, Date.parse(secondary.elements.epoch))
    const relVel = norm(sub(velocity(atEpoch, tca), vp))
    return { atEpoch, relVel }
  })
  const best = candidates.reduce((a, b) =>
    Math.abs(b.relVel - event.relativeVelocityKmS) < Math.abs(a.relVel - event.relativeVelocityKmS) ? b : a,
  )

  const el = best.atEpoch
  secondary.elements = {
    epoch: secondary.elements.epoch,
    smaKm: round(el.smaKm, 3),
    ecc: el.ecc,
    incDeg: el.incDeg,
    raanDeg: round(el.raanDeg, 5),
    argpDeg: round(el.argpDeg, 5),
    meanAnomalyDeg: round(el.meanAnomalyDeg, 5),
  }
  const errKm = norm(sub(propagateEci(secondary.elements, tca), r))
  console.log(
    `${event.id} ${secondary.id.padEnd(14)} miss@TCA ${(errKm * 1000).toFixed(0)} m, ` +
      `rel vel ${best.relVel.toFixed(2)} km/s (seed ${event.relativeVelocityKmS})`,
  )
  event.relativeVelocityKmS = round(best.relVel, 2)
}

writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n')
writeFileSync(CONJUNCTIONS, JSON.stringify(conj, null, 2) + '\n')
