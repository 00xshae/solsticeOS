import type { CatalogSegment, RsoListCategory, SeverityBand } from '@/types'

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** "2026-10-01 06:00:00" in UTC. */
export function formatUtc(timeMs: number, withSeconds = true): string {
  const d = new Date(timeMs)
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${withSeconds ? `:${pad(d.getUTCSeconds())}` : ''}`
  return `${date} ${time}`
}

/** Signed duration like "T-29h 42m" / "T+0h 05m". */
export function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs
  const totalMin = Math.floor(Math.abs(diff) / 60_000)
  return `T${diff >= 0 ? '-' : '+'}${Math.floor(totalMin / 60)}h ${pad(totalMin % 60)}m`
}

/** Compact scientific notation for probabilities, e.g. "3.1e-4"; floor values render as "<1e-10". */
export function formatPc(pc: number): string {
  if (pc <= 1e-10) return '<1e-10'
  const [mantissa, exp] = pc.toExponential(1).split('e')
  return `${mantissa}e${Number(exp)}`
}

/** Solstice-style duration, e.g. "174h 26m 15s". */
export function formatHms(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 3600)}h ${pad(Math.floor((total % 3600) / 60))}m ${pad(total % 60)}s`
}

/** "2 D AGO", "5 H AGO", "12 MIN AGO", "NOW". */
export function formatAgo(thenMs: number, nowMs: number): string {
  const min = Math.floor((nowMs - thenMs) / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min} min ago`
  if (min < 48 * 60) return `${Math.floor(min / 60)} h ago`
  return `${Math.floor(min / 1440)} d ago`
}

export const formatKm =(m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`)

export const SEGMENT_LABEL: Record<CatalogSegment, string> = {
  IND: 'Indian Fleet',
  PAY: 'Payloads',
  RB: 'Rocket Bodies',
  DEB: 'Debris',
}

export const SEGMENT_CODE: Record<CatalogSegment, string> = { IND: 'IND', PAY: 'PAY', RB: 'R/B', DEB: 'DEB' }

/** Object type as Solstice prints it next to a NORAD id, e.g. "41917 · PAYLOAD". */
export const OBJECT_TYPE: Record<CatalogSegment, string> = { IND: 'PAYLOAD', PAY: 'PAYLOAD', RB: 'ROCKET BODY', DEB: 'DEBRIS' }

export const CATEGORY_LABEL: Record<RsoListCategory, string> = {
  owned: 'Owned',
  allied: 'Allied',
  opposed: 'Opposed',
}

/** Hex colours for canvas/WebGL use; keep in sync with the @theme tokens in index.css. */
export const CATEGORY_HEX: Record<RsoListCategory, string> = {
  owned: '#3f7fb0',
  allied: '#3e9b6f',
  opposed: '#d14f4f',
}

export const SEVERITY_HEX: Record<SeverityBand, string> = {
  green: '#3e9b6f',
  blue: '#3f7fb0',
  yellow: '#d6a537',
  orange: '#d97a3f',
  red: '#d14f4f',
}
