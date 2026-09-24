// Static globe overlay for the active COLA plan: the manoeuvred ground track between the
// burns, the secondary's approach around TCA, and B1 / B2 / TCA markers. Rebuilt only when
// the plan changes; everything is Earth-fixed, so satellites fly along it as time advances.
import { rsoById } from '@/data'
import { maneuveredElementsAt } from '@/lib/maneuver'
import { geoAt, type GeoPoint } from '@/lib/orbit'
import type { ConjunctionEvent, ManeuverSequence } from '@/types'

export interface OverlayPath {
  id: string
  points: GeoPoint[]
  color: string
  stroke: number
  dash: number
  gap: number
}

export interface OverlayMarker {
  id: string
  el: HTMLElement
  lat: number
  lng: number
  alt: number
}

const APPROACH_WINDOW_MS = 12 * 60_000

function sample(from: number, to: number, count: number, at: (t: number) => GeoPoint): GeoPoint[] {
  return Array.from({ length: count + 1 }, (_, i) => at(from + ((to - from) * i) / count))
}

function markerElement(text: string, color: string) {
  const el = document.createElement('div')
  el.className =
    'pointer-events-none -translate-y-4 whitespace-nowrap rounded-sm border px-1 font-mono text-[10px] font-semibold tracking-wider'
  el.style.color = color
  el.style.borderColor = color
  el.style.background = 'rgba(11,15,23,0.8)'
  el.textContent = text
  return el
}

export function buildPlanOverlay(
  event: ConjunctionEvent,
  sequence: ManeuverSequence,
  severityHex: string,
  toAlt: (altKm: number) => number,
): { paths: OverlayPath[]; markers: OverlayMarker[] } {
  const primary = rsoById.get(event.primaryId)!.elements
  const secondary = rsoById.get(event.secondaryId)!.elements
  const primaryAt = (t: number) => geoAt(maneuveredElementsAt(primary, sequence, t), t)
  const tca = Date.parse(event.tca)
  const [, burn1, , burn2] = sequence.steps
  const b1 = Date.parse(burn1.start)
  const b2 = Date.parse(burn2.start)

  const paths: OverlayPath[] = [
    {
      id: 'plan-arc',
      points: sample(b1, Date.parse(burn2.end), 360, primaryAt),
      color: '#67e8f9',
      stroke: 0.6,
      dash: 1,
      gap: 0,
    },
    {
      id: 'secondary-approach',
      points: sample(tca - APPROACH_WINDOW_MS, tca + APPROACH_WINDOW_MS, 60, (t) => geoAt(secondary, t)),
      color: severityHex,
      stroke: 0.5,
      dash: 0.02,
      gap: 0.01,
    },
  ]

  const marker = (id: string, text: string, color: string, point: GeoPoint): OverlayMarker => ({
    id,
    el: markerElement(text, color),
    lat: point.lat,
    lng: point.lng,
    alt: toAlt(point.altKm),
  })

  const markers = [
    marker('b1', `B1 +${burn1.deltaVMps.toFixed(2)} m/s`, '#f97316', primaryAt(b1)),
    marker('b2', `B2 −${burn2.deltaVMps.toFixed(2)} m/s`, '#f97316', primaryAt(b2)),
    marker('tca', 'TCA', severityHex, geoAt(secondary, tca)),
  ]
  return { paths, markers }
}
