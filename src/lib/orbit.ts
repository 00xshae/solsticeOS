// Lightweight analytic propagator for the globe.
//
// Two-body Kepler motion plus J2 secular drift of RAAN, argument of perigee and mean
// anomaly: accurate to a few km over the multi-day demo horizon, which is plenty for
// visualisation. Conjunction numbers come from the seeded datasets, not from here.
import type { OrbitalElements } from '@/types'

export const MU_KM3_S2 = 398600.4418
export const EARTH_RADIUS_KM = 6378.137
const J2 = 1.08262668e-3
const DEG = Math.PI / 180
const TWO_PI = 2 * Math.PI

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface GeoPoint {
  lat: number
  lng: number
  altKm: number
}

export const meanMotionRadS = (smaKm: number) => Math.sqrt(MU_KM3_S2 / smaKm ** 3)

export const orbitalPeriodS = (smaKm: number) => TWO_PI / meanMotionRadS(smaKm)

export const circularSpeedKmS = (smaKm: number) => Math.sqrt(MU_KM3_S2 / smaKm)

function solveKepler(meanAnomaly: number, ecc: number): number {
  let E = ecc < 0.8 ? meanAnomaly : Math.PI
  for (let i = 0; i < 12; i++) {
    const dE = (E - ecc * Math.sin(E) - meanAnomaly) / (1 - ecc * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

/** J2 secular rates in rad/s for RAAN, argument of perigee and mean anomaly. */
export function j2Rates(el: OrbitalElements) {
  const n = meanMotionRadS(el.smaKm)
  const p = el.smaKm * (1 - el.ecc ** 2)
  const k = 1.5 * n * J2 * (EARTH_RADIUS_KM / p) ** 2
  const cosI = Math.cos(el.incDeg * DEG)
  const sinI2 = Math.sin(el.incDeg * DEG) ** 2
  return {
    raan: -k * cosI,
    argp: k * (2 - 2.5 * sinI2),
    mean: n + k * Math.sqrt(1 - el.ecc ** 2) * (1 - 1.5 * sinI2),
  }
}

const wrapDeg = (deg: number) => ((deg % 360) + 360) % 360

/** Mean elements re-epoched to `timeMs` by applying the J2 secular drift. */
export function elementsAt(el: OrbitalElements, timeMs: number): OrbitalElements {
  const dt = (timeMs - Date.parse(el.epoch)) / 1000
  const rates = j2Rates(el)
  return {
    ...el,
    epoch: new Date(timeMs).toISOString(),
    raanDeg: wrapDeg(el.raanDeg + (rates.raan * dt) / DEG),
    argpDeg: wrapDeg(el.argpDeg + (rates.argp * dt) / DEG),
    meanAnomalyDeg: wrapDeg(el.meanAnomalyDeg + (rates.mean * dt) / DEG),
  }
}

/** Inertial (TEME-like) position in km at `timeMs`. */
export function propagateEci(el: OrbitalElements, timeMs: number): Vec3 {
  const dt = (timeMs - Date.parse(el.epoch)) / 1000
  const rates = j2Rates(el)
  const raan = el.raanDeg * DEG + rates.raan * dt
  const argp = el.argpDeg * DEG + rates.argp * dt
  const M = (((el.meanAnomalyDeg * DEG + rates.mean * dt) % TWO_PI) + TWO_PI) % TWO_PI

  const E = solveKepler(M, el.ecc)
  const cosE = Math.cos(E)
  const sinE = Math.sin(E)
  // Perifocal coordinates.
  const xp = el.smaKm * (cosE - el.ecc)
  const yp = el.smaKm * Math.sqrt(1 - el.ecc ** 2) * sinE

  const cO = Math.cos(raan)
  const sO = Math.sin(raan)
  const cw = Math.cos(argp)
  const sw = Math.sin(argp)
  const ci = Math.cos(el.incDeg * DEG)
  const si = Math.sin(el.incDeg * DEG)

  return {
    x: (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    y: (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  }
}

/** Greenwich mean sidereal time in radians (IAU 1982, adequate for display). */
export function gmstRad(timeMs: number): number {
  const daysSinceJ2000 = timeMs / 86_400_000 + 2440587.5 - 2451545.0
  const deg = 280.46061837 + 360.98564736629 * daysSinceJ2000
  return (((deg % 360) + 360) % 360) * DEG
}

/** Spherical-Earth geodetic point for the globe. */
export function eciToGeo(r: Vec3, timeMs: number): GeoPoint {
  const theta = gmstRad(timeMs)
  const x = r.x * Math.cos(theta) + r.y * Math.sin(theta)
  const y = -r.x * Math.sin(theta) + r.y * Math.cos(theta)
  const radius = Math.hypot(x, y, r.z)
  return {
    lat: Math.asin(r.z / radius) / DEG,
    lng: Math.atan2(y, x) / DEG,
    altKm: radius - EARTH_RADIUS_KM,
  }
}

export const geoAt = (el: OrbitalElements, timeMs: number): GeoPoint => eciToGeo(propagateEci(el, timeMs), timeMs)

/**
 * Ground-fixed trace of one revolution centred on `timeMs`. Each point is evaluated at its
 * own time, so the ring shows where the object actually flies over the rotating Earth.
 */
export function orbitTrack(el: OrbitalElements, timeMs: number, samples = 180): GeoPoint[] {
  const periodMs = orbitalPeriodS(el.smaKm) * 1000
  const start = timeMs - periodMs / 2
  return Array.from({ length: samples + 1 }, (_, i) => geoAt(el, start + (periodMs * i) / samples))
}

/**
 * The inertial orbit plane drawn in Earth-fixed coordinates at a single instant, i.e. the
 * classic "orbit ring" around the globe.
 */
export function orbitRing(el: OrbitalElements, timeMs: number, samples = 180): GeoPoint[] {
  const periodMs = orbitalPeriodS(el.smaKm) * 1000
  return Array.from({ length: samples + 1 }, (_, i) =>
    eciToGeo(propagateEci(el, timeMs + (periodMs * i) / samples), timeMs),
  )
}
