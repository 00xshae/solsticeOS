import { useEffect, useRef } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'
import * as THREE from 'three'
import { LocateFixed } from 'lucide-react'
import { rsoById } from '@/data'
import { SEVERITY_HEX } from '@/lib/format'
import { maneuveredElementsAt } from '@/lib/maneuver'
import { EARTH_RADIUS_KM, geoAt, orbitRing, type GeoPoint } from '@/lib/orbit'
import {
  selectActiveConjunction,
  selectActiveSequence,
  selectDisplayTimeMs,
  selectSeverity,
  useMissionStore,
  type MissionState,
} from '@/store/missionStore'
import type { OrbitalElements, RSOObject } from '@/types'
import { buildPlanOverlay, type OverlayMarker, type OverlayPath } from './planOverlay'

const HOME_VIEW = { lat: 18, lng: 79, altitude: 2.6 }
const OVERLAY_REFRESH_MS = 250
const SAT_HEX = '#ffffff'
const RING_COLOR = 'rgba(255, 255, 255, 0.7)'
const SELECTED_RING_COLOR = 'rgba(255, 255, 255, 0.95)'

/** Persistent per-object datum: globe.gl binds meshes by identity, so we mutate these in place. */
interface SatDatum {
  id: string
  object: RSOObject
  lat: number
  lng: number
  alt: number
}

/** Anything drawn as an HTML label: object names and plan markers share one layer. */
type HtmlDatum = OverlayMarker

const toAlt = (altKm: number) => altKm / EARTH_RADIUS_KM

/** Radial white-to-transparent falloff, drawn once and shared by every glow sprite. */
function glowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

/** White core plus an additive glow sprite; geometry and materials are shared across objects. */
function satMeshFactory() {
  const core = new THREE.SphereGeometry(0.9, 12, 8)
  const coreMaterial = new THREE.MeshBasicMaterial({ color: SAT_HEX })
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: SAT_HEX,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const make = () => {
    const group = new THREE.Group()
    group.add(new THREE.Mesh(core, coreMaterial))
    const glow = new THREE.Sprite(glowMaterial)
    glow.scale.setScalar(7)
    group.add(glow)
    return group
  }
  make.dispose = () => {
    core.dispose()
    coreMaterial.dispose()
    glowMaterial.map?.dispose()
    glowMaterial.dispose()
  }
  return make
}

function labelElement(object: RSOObject) {
  const el = document.createElement('div')
  el.className =
    'pointer-events-none -translate-y-5 animate-fade-in whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm'
  el.textContent = object.name
  return el
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

    // Only tracked objects are drawn; data is cached by id so globe.gl keeps each mesh across frames.
    const satById = new Map<string, SatDatum>()
    const trackedSats = (ids: string[]): SatDatum[] =>
      ids.flatMap((id) => {
        let sat = satById.get(id)
        if (!sat) {
          const object = rsoById.get(id)
          if (!object) return []
          sat = { id, object, lat: 0, lng: 0, alt: 0 }
          satById.set(id, sat)
        }
        return [sat]
      })
    const satMesh = satMeshFactory()
    const labels = new Map<string, HtmlDatum>()
    let plan: { key: string; paths: OverlayPath[]; markers: OverlayMarker[] } | null = null

    const globe = new Globe(container, { animateIn: false })
      .backgroundColor('#000000')
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
      .objectThreeObject(() => satMesh())
      .objectLabel((d) => {
        const { object } = d as SatDatum
        return `<div class="text-[11px] font-medium">${object.name}<br/><span class="font-mono font-normal" style="opacity:.6">NORAD ${object.noradId}</span></div>`
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
        if (sat && !labels.has(id)) labels.set(id, { id, el: labelElement(sat.object), lat: 0, lng: 0, alt: 0 })
      }
    }

    const ringsFor = (s: MissionState, timeMs: number): OverlayPath[] => {
      const conj = selectActiveConjunction(s)
      const severityHex = conj ? SEVERITY_HEX[selectSeverity(s, conj).band] : null
      return s.trackedIds.flatMap((id) => {
        const object = rsoById.get(id)
        if (!object) return []
        return [
          {
            id,
            points: orbitRing(effectiveElements(s, object, timeMs), timeMs),
            color:
              conj?.secondaryId === id && severityHex
                ? severityHex
                : id === s.selectedRsoId
                  ? SELECTED_RING_COLOR
                  : RING_COLOR,
            stroke: id === s.selectedRsoId ? 0.9 : 0.6,
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

      const sats = trackedSats(s.trackedIds)
      for (const sat of sats) {
        const geo = geoAt(effectiveElements(s, sat.object, timeMs), timeMs)
        sat.lat = geo.lat
        sat.lng = geo.lng
        sat.alt = toAlt(geo.altKm)
      }
      globe.objectsData(sats)

      if (now - lastOverlayAt > OVERLAY_REFRESH_MS) {
        lastOverlayAt = now
        syncLabels(s.trackedIds)
        syncPlan(s)
        rings = ringsFor(s, timeMs)
        globe.pathsData([...rings, ...(plan?.paths ?? [])])
      }
      for (const label of labels.values()) {
        const sat = satById.get(label.id)
        if (!sat) continue
        label.lat = sat.lat
        label.lng = sat.lng
        label.alt = sat.alt
      }
      globe.htmlElementsData([...labels.values(), ...(plan?.markers ?? [])])

      const followed =
        s.followSelected && s.selectedRsoId && s.trackedIds.includes(s.selectedRsoId) ? satById.get(s.selectedRsoId) : undefined
      if (followed) globe.pointOfView({ lat: followed.lat, lng: followed.lng, altitude: globe.pointOfView().altitude })

      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      globe._destructor()
      satMesh.dispose()
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
    <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black" aria-label="3D operating picture">
      <div ref={containerRef} className="absolute inset-0" />
      <GlobeLegend />
      <button
        type="button"
        onClick={() => globeRef.current?.pointOfView(HOME_VIEW, 1000)}
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-secondary backdrop-blur-md transition-colors duration-100 ease-out hover:text-primary light:shadow-lg"
      >
        <LocateFixed className="size-3.5" /> Reset view
      </button>
    </section>
  )
}

function GlobeLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-glass-border bg-glass px-3 py-2 backdrop-blur-xl light:shadow-lg">
      <div className="mb-1.5 text-[10px] text-tertiary">Earth-fixed · Kepler + J₂</div>
      <div className="flex gap-3 text-[10px] font-medium text-primary">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white shadow-[0_0_6px_2px_rgba(255,255,255,0.6)] light:shadow-none light:ring-1 light:ring-stone-400" />
          Tracked RSO
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-[#67e8f9] light:bg-cyan-600" />
          COLA arc
        </span>
      </div>
    </div>
  )
}
