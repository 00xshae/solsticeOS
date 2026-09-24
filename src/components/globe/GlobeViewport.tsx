import { useEffect, useRef, useState } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'
import * as THREE from 'three'
import { Globe2, LocateFixed, Map as MapIcon, Orbit } from 'lucide-react'
import { rsoById } from '@/data'
import { cn } from '@/lib/cn'
import { SEVERITY_HEX } from '@/lib/format'
import { maneuveredElementsAt } from '@/lib/maneuver'
import { EARTH_RADIUS_KM, geoAt, orbitRing, type GeoPoint } from '@/lib/orbit'
import {
  selectActiveConjunction,
  selectActiveIntercept,
  selectActiveSequence,
  selectActiveThreatWindow,
  selectDisplayTimeMs,
  selectSeverity,
  selectWindowRating,
  useMissionStore,
  type MissionState,
} from '@/store/missionStore'
import type { OrbitalElements, RSOObject } from '@/types'
import { buildInterceptOverlay, buildPlanOverlay, type OverlayMarker, type OverlayPath } from './planOverlay'

const HOME_VIEW = { lat: 18, lng: 79, altitude: 2.6 }
const OVERLAY_REFRESH_MS = 250
const SAT_HEX = '#ffffff'
const RING_COLOR = 'rgba(255, 255, 255, 0.7)'
const SELECTED_RING_COLOR = 'rgba(255, 255, 255, 0.95)'

export type GlobeSurface = 'physical' | 'wireframe' | 'political'

const SURFACE_OPTIONS: { value: GlobeSurface; label: string; icon: typeof Globe2 }[] = [
  { value: 'physical', label: 'Physical', icon: Globe2 },
  { value: 'wireframe', label: 'Wireframe', icon: Orbit },
  { value: 'political', label: 'Political', icon: MapIcon },
]

interface CountryFeature {
  properties?: { ADM0_A3?: string; ADMIN?: string }
}

/** Natural Earth 110m country outlines, fetched once and shared across surface switches. */
let countriesPromise: Promise<CountryFeature[]> | null = null
function loadCountries(): Promise<CountryFeature[]> {
  countriesPromise ??= fetch('/data/ne_110m_admin_0_countries.geojson')
    .then((r) => r.json())
    .then((geojson: { features: CountryFeature[] }) => geojson.features)
  return countriesPromise
}

// Muted, print-atlas-style palette; assigned deterministically so a country keeps its colour
// across surface switches instead of jittering on every re-render.
const POLITICAL_PALETTE = [
  'rgba(239, 137, 96, 0.55)',
  'rgba(122, 172, 122, 0.55)',
  'rgba(122, 158, 199, 0.55)',
  'rgba(216, 180, 122, 0.55)',
  'rgba(180, 140, 199, 0.55)',
  'rgba(153, 194, 183, 0.55)',
  'rgba(214, 158, 173, 0.55)',
  'rgba(163, 177, 138, 0.55)',
]
function countryColor(feature: object) {
  const key = (feature as CountryFeature).properties?.ADM0_A3 ?? (feature as CountryFeature).properties?.ADMIN ?? ''
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return POLITICAL_PALETTE[Math.abs(hash) % POLITICAL_PALETTE.length]!
}

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
    'pointer-events-none -translate-y-5 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm'
  el.textContent = object.name
  return el
}

/**
 * Elements to propagate for an object at the display time: the owned asset flies its COLA
 * plan, and a threat window's chaser flies the selected intercept.
 */
function effectiveElements(s: MissionState, object: RSOObject, timeMs: number): OrbitalElements {
  const conj = selectActiveConjunction(s)
  const sequence = selectActiveSequence(s)
  if (conj && sequence && conj.primaryId === object.id) return maneuveredElementsAt(object.elements, sequence, timeMs)
  const threat = selectActiveThreatWindow(s)
  const intercept = selectActiveIntercept(s)
  if (threat && intercept && threat.opposedId === object.id) return maneuveredElementsAt(object.elements, intercept, timeMs)
  return object.elements
}

/** Colour of the pair's highlighted ring and overlay: the active pair's rating band. */
function pairHex(s: MissionState): { id: string; hex: string } | null {
  const conj = selectActiveConjunction(s)
  if (conj) return { id: conj.secondaryId, hex: SEVERITY_HEX[selectSeverity(s, conj).band] }
  const threat = selectActiveThreatWindow(s)
  const rating = threat && selectWindowRating(s, threat)
  return threat && rating ? { id: threat.opposedId, hex: SEVERITY_HEX[rating.band] } : null
}

export function GlobeViewport() {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const [surface, setSurface] = useState<GlobeSurface>('physical')

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
      .polygonsData([])
      .polygonAltitude(0.006)
      .polygonCapColor(countryColor)
      .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
      .polygonStrokeColor(() => 'rgba(250, 250, 249, 0.35)')
      .polygonsTransitionDuration(0)
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
      const pair = pairHex(s)
      return s.trackedIds.flatMap((id) => {
        const object = rsoById.get(id)
        if (!object) return []
        return [
          {
            id,
            points: orbitRing(effectiveElements(s, object, timeMs), timeMs),
            color:
              pair?.id === id
                ? pair.hex
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
      const threat = selectActiveThreatWindow(s)
      const intercept = selectActiveIntercept(s)
      const hex = pairHex(s)?.hex ?? '#a8a29e'
      // Key on the band too, so the overlay recolours when the rating crosses a band.
      const key = conj && sequence ? sequence.id : threat && intercept ? `${intercept.id}:${hex}` : ''
      if ((plan?.key ?? '') === key) return
      plan =
        conj && sequence
          ? { key, ...buildPlanOverlay(conj, sequence, hex, toAlt) }
          : threat && intercept
            ? { key, ...buildInterceptOverlay(threat, intercept, hex, toAlt) }
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

  // Swap the globe's surface: a textured photograph, a translucent lat/long grid, or Natural
  // Earth country polygons coloured like a print atlas. Runs independently of the main effect so
  // switching surfaces never rebuilds the globe (camera, tracked objects, overlays untouched).
  //
  // The blue-marble/bump textures are loaded once, in the main effect, and never re-requested
  // here: every mode below only retints the existing material (colour/opacity/transparent are
  // plain synchronous property writes). An earlier version cleared globeImageUrl/bumpImageUrl to
  // '' for wireframe/political and set them back to the real URLs for physical, relying on
  // three-globe's own async TextureLoader to reload and re-tint the map on the way back — that
  // reload could still be in flight (or lose a race against the next click) when the user
  // switched away again, leaving physical stuck tinted black. Never touching the URL removes the
  // race entirely.
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    let cancelled = false

    const material = globe.globeMaterial() as THREE.MeshPhongMaterial
    if (surface === 'wireframe') {
      material.color = new THREE.Color(0x000000)
      material.transparent = true
      material.opacity = 0.35
      material.needsUpdate = true
      globe.showGraticules(true).polygonsData([])
    } else if (surface === 'political') {
      material.color = new THREE.Color(0x000000)
      material.transparent = false
      material.opacity = 1
      material.needsUpdate = true
      globe.showGraticules(false)
      loadCountries().then((features) => {
        if (!cancelled) globe.polygonsData(features)
      })
    } else {
      material.color = new THREE.Color(0xffffff)
      material.transparent = false
      material.opacity = 1
      material.needsUpdate = true
      globe.showGraticules(false).polygonsData([])
    }

    return () => {
      cancelled = true
    }
  }, [surface])

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
      <SurfaceSwitcher surface={surface} onChange={setSurface} />
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

/** Globe surface picker: physical imagery, a translucent lat/long grid, or political boundaries. */
function SurfaceSwitcher({ surface, onChange }: { surface: GlobeSurface; onChange: (surface: GlobeSurface) => void }) {
  return (
    <div
      className="absolute left-3 top-3 flex overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-md light:shadow-lg"
      role="radiogroup"
      aria-label="Globe surface"
    >
      {SURFACE_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={surface === value}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors duration-100 ease-out',
            surface === value ? 'bg-accent-muted text-accent' : 'text-secondary hover:bg-elevated hover:text-primary',
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function GlobeLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-glass-border bg-glass px-3 py-2 backdrop-blur-xl light:shadow-lg">
      <div className="mb-1.5 text-[10px] text-secondary">Earth-fixed · Kepler + J₂</div>
      <div className="flex gap-3 text-[10px] font-medium text-primary">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white shadow-[0_0_6px_2px_rgba(255,255,255,0.6)] light:shadow-none light:ring-1 light:ring-stone-400" />
          Tracked RSO
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-[#67e8f9] light:bg-cyan-600" />
          COLA arc
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-sev-red" />
          Intercept
        </span>
      </div>
    </div>
  )
}
