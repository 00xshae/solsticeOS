import { useEffect, useRef } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'
import * as THREE from 'three'
import { LocateFixed } from 'lucide-react'
import { rsoById, rsoObjects } from '@/data'
import { CATEGORY_HEX, SEVERITY_HEX } from '@/lib/format'
import { maneuveredElementsAt } from '@/lib/maneuver'
import { EARTH_RADIUS_KM, geoAt, orbitRing, type GeoPoint } from '@/lib/orbit'
import {
  rsoCategories,
  selectActiveConjunction,
  selectActiveSequence,
  selectDisplayTimeMs,
  selectSeverity,
  useMissionStore,
  type MissionState,
} from '@/store/missionStore'
import type { OrbitalElements, RSOObject, RsoListCategory } from '@/types'
import { buildPlanOverlay, type OverlayMarker, type OverlayPath } from './planOverlay'

const HOME_VIEW = { lat: 18, lng: 79, altitude: 2.6 }
const OVERLAY_REFRESH_MS = 250

/** Persistent per-object datum: globe.gl binds meshes by identity, so we mutate these in place. */
interface SatDatum {
  id: string
  object: RSOObject
  category: RsoListCategory
  lat: number
  lng: number
  alt: number
}

/** Anything drawn as an HTML label: object names and plan markers share one layer. */
type HtmlDatum = OverlayMarker

const toAlt = (altKm: number) => altKm / EARTH_RADIUS_KM

function primaryCategory(id: string): RsoListCategory {
  const categories = rsoCategories(id)
  return categories.includes('protected') ? 'protected' : categories.includes('uncooperative') ? 'uncooperative' : 'cooperative'
}

function satMesh(category: RsoListCategory) {
  const color = new THREE.Color(CATEGORY_HEX[category])
  const group = new THREE.Group()
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color })))
  // Soft halo so small objects stay findable when zoomed out.
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 12, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }),
    ),
  )
  return group
}

function labelElement(object: RSOObject, category: RsoListCategory) {
  const el = document.createElement('div')
  el.className =
    'pointer-events-none -translate-y-5 whitespace-nowrap rounded-sm bg-void/70 px-1.5 py-px font-mono text-[10px] tracking-wider'
  el.style.color = CATEGORY_HEX[category]
  el.textContent = object.name
  return el
}

/** Objects whose names and rings are shown: the selection plus the active conjunction pair. */
function focusIds(s: MissionState): string[] {
  const conj = selectActiveConjunction(s)
  const ids = new Set<string>()
  if (s.selectedRsoId) ids.add(s.selectedRsoId)
  if (conj) {
    ids.add(conj.primaryId)
    ids.add(conj.secondaryId)
  }
  return [...ids]
}

/** Elements to propagate for an object at the display time, honouring the active COLA plan. */
function effectiveElements(s: MissionState, object: RSOObject, timeMs: number): OrbitalElements {
  const conj = selectActiveConjunction(s)
  const sequence = selectActiveSequence(s)
  return conj && sequence && conj.primaryId === object.id
    ? maneuveredElementsAt(object.elements, sequence, timeMs)
    : object.elements
}

export function GlobeViewport() {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sats: SatDatum[] = rsoObjects.map((object) => ({
      id: object.id,
      object,
      category: primaryCategory(object.id),
      lat: 0,
      lng: 0,
      alt: 0,
    }))
    const satById = new Map(sats.map((d) => [d.id, d]))
    const labels = new Map<string, HtmlDatum>()
    let plan: { key: string; paths: OverlayPath[]; markers: OverlayMarker[] } | null = null

    const globe = new Globe(container, { animateIn: false })
      .backgroundColor('#0b0f17')
      .backgroundImageUrl('/textures/night-sky.png')
      .globeImageUrl('/textures/earth-blue-marble.jpg')
      .bumpImageUrl('/textures/earth-topology.png')
      .showAtmosphere(true)
      .atmosphereColor('#38bdf8')
      .atmosphereAltitude(0.18)
      .objectLat('lat')
      .objectLng('lng')
      .objectAltitude('alt')
      .objectFacesSurface(false)
      .objectThreeObject((d) => satMesh((d as SatDatum).category))
      .objectLabel((d) => {
        const { object } = d as SatDatum
        return `<div class="font-mono text-[11px]">${object.name}<br/><span style="opacity:.6">NORAD ${object.noradId}</span></div>`
      })
      .onObjectClick((d) => {
        const { selectedRsoId, selectRso } = useMissionStore.getState()
        const id = (d as SatDatum).id
        selectRso(selectedRsoId === id ? null : id)
      })
      .pathPoints('points')
      .pathPointLat('lat')
      .pathPointLng('lng')
      .pathPointAlt((p) => toAlt((p as GeoPoint).altKm))
      .pathColor((d: object) => (d as OverlayPath).color)
      .pathStroke((d: object) => (d as OverlayPath).stroke)
      .pathDashLength((d: object) => (d as OverlayPath).dash)
      .pathDashGap((d: object) => (d as OverlayPath).gap)
      .pathTransitionDuration(0)
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude('alt')
      .htmlElement((d: object) => (d as HtmlDatum).el)
      .htmlTransitionDuration(0)
      .pointOfView(HOME_VIEW)
    // Headlight: keep the lit hemisphere facing the viewer wherever the camera orbits.
    const headlight = new THREE.DirectionalLight(0xffffff, 0.9 * Math.PI)
    globe.lights([new THREE.AmbientLight(0xcccccc, 0.65 * Math.PI), headlight])
    globe.controls().autoRotate = false
    globeRef.current = globe

    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return
      globe.width(entry.contentRect.width).height(entry.contentRect.height)
    })
    resize.observe(container)

    const syncLabels = (ids: string[]) => {
      for (const id of labels.keys()) if (!ids.includes(id)) labels.delete(id)
      for (const id of ids) {
        const sat = satById.get(id)
        if (sat && !labels.has(id)) labels.set(id, { id, el: labelElement(sat.object, sat.category), lat: 0, lng: 0, alt: 0 })
      }
    }

    const ringsFor = (s: MissionState, timeMs: number): OverlayPath[] => {
      const conj = selectActiveConjunction(s)
      const severityHex = conj ? SEVERITY_HEX[selectSeverity(s, conj).band] : null
      return focusIds(s).flatMap((id) => {
        const object = rsoById.get(id)
        if (!object) return []
        return [
          {
            id,
            points: orbitRing(effectiveElements(s, object, timeMs), timeMs),
            color: conj?.secondaryId === id && severityHex ? severityHex : CATEGORY_HEX[primaryCategory(id)],
            stroke: id === s.selectedRsoId ? 0.5 : 0.3,
            dash: 1,
            gap: 0,
          },
        ]
      })
    }

    const syncPlan = (s: MissionState) => {
      const conj = selectActiveConjunction(s)
      const sequence = selectActiveSequence(s)
      const key = conj && sequence ? sequence.id : ''
      if ((plan?.key ?? '') === key) return
      plan =
        conj && sequence
          ? { key, ...buildPlanOverlay(conj, sequence, SEVERITY_HEX[selectSeverity(s, conj).band], toAlt) }
          : null
    }

    let frame = 0
    let lastOverlayAt = -Infinity
    let rings: OverlayPath[] = []
    const render = (now: number) => {
      headlight.position.copy(globe.camera().position)
      const s = useMissionStore.getState()
      const timeMs = selectDisplayTimeMs(s)

      for (const sat of sats) {
        const geo = geoAt(effectiveElements(s, sat.object, timeMs), timeMs)
        sat.lat = geo.lat
        sat.lng = geo.lng
        sat.alt = toAlt(geo.altKm)
      }
      globe.objectsData(sats)

      if (now - lastOverlayAt > OVERLAY_REFRESH_MS) {
        lastOverlayAt = now
        syncLabels(focusIds(s))
        syncPlan(s)
        rings = ringsFor(s, timeMs)
        globe.pathsData([...rings, ...(plan?.paths ?? [])])
      }
      for (const label of labels.values()) {
        const sat = satById.get(label.id)!
        label.lat = sat.lat
        label.lng = sat.lng
        label.alt = sat.alt
      }
      globe.htmlElementsData([...labels.values(), ...(plan?.markers ?? [])])

      const followed = s.followSelected && s.selectedRsoId ? satById.get(s.selectedRsoId) : undefined
      if (followed) globe.pointOfView({ lat: followed.lat, lng: followed.lng, altitude: globe.pointOfView().altitude })

      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      globe._destructor()
      container.replaceChildren()
      globeRef.current = null
    }
  }, [])

  // Fly to the newly selected object.
  const selectedRsoId = useMissionStore((s) => s.selectedRsoId)
  useEffect(() => {
    const globe = globeRef.current
    const object = selectedRsoId ? rsoById.get(selectedRsoId) : null
    if (!globe || !object) return
    const s = useMissionStore.getState()
    const timeMs = selectDisplayTimeMs(s)
    const geo = geoAt(effectiveElements(s, object, timeMs), timeMs)
    globe.pointOfView({ lat: geo.lat, lng: geo.lng, altitude: 1.8 }, 1200)
  }, [selectedRsoId])

  return (
    <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-void" aria-label="3D operating picture">
      <div ref={containerRef} className="absolute inset-0" />
      <GlobeLegend />
      <button
        type="button"
        onClick={() => globeRef.current?.pointOfView(HOME_VIEW, 1000)}
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded border border-line bg-panel/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-muted backdrop-blur hover:text-ink"
      >
        <LocateFixed className="size-3.5" /> Reset view
      </button>
    </section>
  )
}

function GlobeLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-line bg-panel/80 px-3 py-2 backdrop-blur">
      <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-ink-faint">Earth-fixed · Kepler + J2</div>
      <div className="flex gap-3 font-mono text-[10px] uppercase tracking-wider">
        {(Object.keys(CATEGORY_HEX) as RsoListCategory[]).map((c) => (
          <span key={c} className="flex items-center gap-1.5" style={{ color: CATEGORY_HEX[c] }}>
            <span className="size-2 rounded-full bg-current" />
            {c}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[#67e8f9]">
          <span className="h-0.5 w-3 bg-current" />
          COLA arc
        </span>
      </div>
    </div>
  )
}
