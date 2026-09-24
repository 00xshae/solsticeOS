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

export const formatKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`)

export const SEGMENT_LABEL: Record<CatalogSegment, string> = {
  IND: 'Indian Fleet',
  PAY: 'Payloads',
  RB: 'Rocket Bodies',
  DEB: 'Debris',
}

export const SEGMENT_CODE: Record<CatalogSegment, string> = { IND: 'IND', PAY: 'PAY', RB: 'R/B', DEB: 'DEB' }

export const CATEGORY_LABEL: Record<RsoListCategory, string> = {
  protected: 'Protected',
  cooperative: 'Cooperative',
  uncooperative: 'Uncooperative',
}

/** Hex colours for canvas/WebGL use; keep in sync with the @theme tokens in index.css. */
export const CATEGORY_HEX: Record<RsoListCategory, string> = {
  protected: '#06b6d4',
  cooperative: '#34d399',
  uncooperative: '#f59e0b',
}

export const SEVERITY_HEX: Record<SeverityBand, string> = {
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
}
