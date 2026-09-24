// Static globe overlay for the active COLA plan: the manoeuvred ground track between the
// burns, the secondary's approach around TCA, and B1 / B2 / TCA markers. Rebuilt only when
// the plan changes; everything is Earth-fixed, so satellites fly along it as time advances.
import { rsoById } from '@/data'
import { maneuveredElementsAt } from '@/lib/maneuver'
import { geoAt, orbitalPeriodS, type GeoPoint } from '@/lib/orbit'
import type { ConjunctionEvent, InterceptSequence, ManeuverSequence, ManeuverStep, ThreatWindow } from '@/types'

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
    'pointer-events-none -translate-y-4 whitespace-nowrap rounded border px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums backdrop-blur-sm'
  el.style.color = color
  el.style.borderColor = color
  el.style.background = 'rgba(0,0,0,0.7)'
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
      // Early burns are revolutions before TCA; draw only the final approach through Burn 2
      // so the arc does not wrap the globe several times.
      points: sample(Math.max(b1, tca - (orbitalPeriodS(primary.smaKm) * 1000) / 2), Date.parse(burn2.end), 240, primaryAt),
      color: '#7fa0b3',
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
    marker('b1', `B1 +${burn1.deltaVMps.toFixed(2)} m/s`, '#a66a42', primaryAt(b1)),
    marker('b2', `B2 −${burn2.deltaVMps.toFixed(2)} m/s`, '#a66a42', primaryAt(b2)),
    marker('tca', 'TCA', severityHex, geoAt(secondary, tca)),
  ]
  return { paths, markers }
}

const signed = (step: ManeuverStep) => `${Math.sign(step.direction?.inTrack ?? 1) < 0 ? '−' : '+'}${step.deltaVMps.toFixed(2)} m/s`

/**
 * Overlay for an intercept: the chaser's final revolution into Burn 2 in the rating colour,
 * plus B1 / B2 markers and the arrival point on the target. Burn 1 is usually many
 * revolutions earlier, so only its marker is drawn, not the whole phasing arc.
 */
export function buildInterceptOverlay(
  window: ThreatWindow,
  sequence: InterceptSequence,
  ratingHex: string,
  toAlt: (altKm: number) => number,
): { paths: OverlayPath[]; markers: OverlayMarker[] } {
  const chaser = rsoById.get(window.opposedId)!.elements
  const target = rsoById.get(window.targetId)!.elements
  const chaserAt = (t: number) => geoAt(maneuveredElementsAt(chaser, sequence, t), t)
  const [, burn1, , burn2] = sequence.steps
  const b1 = Date.parse(burn1.start)
  const b2 = Date.parse(burn2.start)
  const arrival = Date.parse(burn2.end)
  const periodMs = orbitalPeriodS(chaser.smaKm) * 1000

  const paths: OverlayPath[] = [
    {
      id: 'intercept-approach',
      points: sample(Math.max(b1, b2 - periodMs), arrival, 240, chaserAt),
      color: ratingHex,
      stroke: 0.6,
      dash: 0.02,
      gap: 0.008,
    },
  ]
  const marker = (id: string, text: string, color: string, point: GeoPoint): OverlayMarker => ({
    id,
    el: markerElement(text, color),
    lat: point.lat,
    lng: point.lng,
    alt: toAlt(point.altKm),
  })
  return {
    paths,
    markers: [
      marker('b1', `B1 ${signed(burn1)}`, '#a66a42', chaserAt(b1)),
      marker('b2', `B2 ${signed(burn2)}`, '#a66a42', chaserAt(b2)),
      marker('arrival', `ARRIVAL · ${sequence.standoffKm.toFixed(1)} km`, ratingHex, geoAt(target, arrival)),
    ],
  }
}
