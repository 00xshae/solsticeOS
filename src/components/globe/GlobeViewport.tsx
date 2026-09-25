import { useEffect, useRef, useState } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'
import * as THREE from 'three'
import { Globe2, LocateFixed, Map as MapIcon, Orbit } from 'lucide-react'
import { rsoById } from '@/data'
import { cn } from '@/lib/cn'
import { CATEGORY_HEX, CATEGORY_LABEL, SEVERITY_HEX } from '@/lib/format'
import { maneuveredElementsAt } from '@/lib/maneuver'
import { EARTH_RADIUS_KM, geoAt, orbitRing, type GeoPoint } from '@/lib/orbit'
import {
  selectActiveConjunction,
  selectActiveIntercept,
  selectActiveSequence,
  selectActiveThreatWindow,
  selectCategories,
  selectDisplayTimeMs,
  selectSeverity,
  selectWindowRating,
  useMissionStore,
  type MissionState,
  type SpeedMultiplier,
} from '@/store/missionStore'
import type { OrbitalElements, RSOObject, RsoListCategory } from '@/types'
import { buildInterceptOverlay, buildPlanOverlay, type OverlayMarker, type OverlayPath } from './planOverlay'

const HOME_VIEW = { lat: 18, lng: 79, altitude: 2.6 }
const OVERLAY_REFRESH_MS = 250
/** Objects on no list stay neutral white; listed ones take their category colour. */
const UNLISTED_HEX = '#ffffff'
/** Colour of the slow, blinking glow once a pair is actually close, not merely selected. */
const ATTENTION_HEX = '#ff2d2d'
/** One full dim-to-bright-to-dim cycle, in milliseconds. */
const ATTENTION_PERIOD_MS = 1600

/** Pinned for the threat-window demo pair, regardless of list membership. */
const NAMED_HEX: Record<string, string> = {
  'CARTOSAT-3': CATEGORY_HEX.owned,
  'INSP-1': CATEGORY_HEX.opposed,
}

/** Owned wins over allied over opposed. The dot itself never changes colour for attention —
 *  only its glow does, see the render loop below. */
const globeHex = (s: MissionState, id: string) => {
  if (NAMED_HEX[id]) return NAMED_HEX[id]
  const [category] = selectCategories(s, id)
  return category ? CATEGORY_HEX[category] : UNLISTED_HEX
}

const withAlpha = (hex: string, alpha: number) => {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

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
  'rgba(224, 122, 79, 0.72)',
  'rgba(94, 163, 94, 0.72)',
  'rgba(91, 145, 199, 0.72)',
  'rgba(214, 165, 87, 0.72)',
  'rgba(163, 117, 199, 0.72)',
  'rgba(94, 175, 158, 0.72)',
  'rgba(206, 121, 148, 0.72)',
  'rgba(140, 158, 94, 0.72)',
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
  /** Category colour the mesh was built with; a new datum replaces this one when it changes. */
  hex: string
  /** Stashed on first objectThreeObject call so the render loop can reach its glow sprite. */
  mesh?: THREE.Group
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

/**
 * Coloured core plus an additive glow sprite. Geometry and the glow texture are shared; the
 * materials are cached per colour, so objects in the same category share them too.
 */
function satMeshFactory() {
  const core = new THREE.SphereGeometry(0.9, 12, 8)
  const texture = glowTexture()
  const materials = new Map<string, { core: THREE.MeshBasicMaterial; glow: THREE.SpriteMaterial }>()
  const materialsFor = (hex: string) => {
    let m = materials.get(hex)
    if (!m) {
      m = {
        core: new THREE.MeshBasicMaterial({ color: hex }),
        glow: new THREE.SpriteMaterial({
          map: texture,
          color: hex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      }
      materials.set(hex, m)
    }
    return m
  }
  const make = (hex: string) => {
    const m = materialsFor(hex)
    const group = new THREE.Group()
    group.add(new THREE.Mesh(core, m.core))
    const glow = new THREE.Sprite(m.glow)
    glow.scale.setScalar(7)
    group.add(glow)
    // Stashed so the render loop can swap just the glow's material for the blinking attention
    // colour — and swap it back to the object's own category glow — without touching the core.
    group.userData.glow = glow
    group.userData.categoryGlow = m.glow
    return group
  }
  make.dispose = () => {
    core.dispose()
    texture.dispose()
    for (const m of materials.values()) {
      m.core.dispose()
      m.glow.dispose()
    }
  }
  return make
}

function labelElement(object: RSOObject, hex: string) {
  const el = document.createElement('div')
  el.className =
    'pointer-events-none -translate-y-5 whitespace-nowrap rounded border-l-2 bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm'
  el.style.borderLeftColor = hex
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

/**
 * Both parties of the pair once it's actually close — not the moment it's opened in the UI, but
 * once its own severity or threat rating has crossed into orange/red. For a conjunction that
 * tracks real proximity/probability as it evolves; for a threat window it naturally follows once
 * the chaser is past Burn 1 and closing, since "soon" is one of the rating's own factors.
 */
function attentionActive(s: MissionState): string[] {
  const conj = selectActiveConjunction(s)
  if (conj) {
    const band = selectSeverity(s, conj).band
    return band === 'orange' || band === 'red' ? [conj.primaryId, conj.secondaryId] : []
  }
  const threat = selectActiveThreatWindow(s)
  if (!threat) return []
  const rating = selectWindowRating(s, threat)
  return rating && (rating.band === 'orange' || rating.band === 'red') ? [threat.targetId, threat.opposedId] : []
}

export function GlobeViewport() {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const [surface, setSurface] = useState<GlobeSurface>('physical')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Only tracked objects are drawn; data is cached by id so globe.gl keeps each mesh across
    // frames. A category change (list edit) swaps in a new datum so the mesh is rebuilt.
    const satById = new Map<string, SatDatum>()
    const trackedSats = (s: MissionState): SatDatum[] =>
      s.trackedIds.flatMap((id) => {
        const hex = globeHex(s, id)
        let sat = satById.get(id)
        if (!sat || sat.hex !== hex) {
          const object = rsoById.get(id)
          if (!object) return []
          sat = { id, object, hex, lat: sat?.lat ?? 0, lng: sat?.lng ?? 0, alt: sat?.alt ?? 0 }
          satById.set(id, sat)
          labels.delete(id)
        }
        return [sat]
      })
    const satMesh = satMeshFactory()
    const labels = new Map<string, HtmlDatum>()
    let plan: { key: string; paths: OverlayPath[]; markers: OverlayMarker[] } | null = null

    // One shared, blinking-red material for every glow currently in "attention" — the core dot
    // underneath keeps its own owned/allied/opposed colour throughout.
    const attentionGlowMaterial = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: ATTENTION_HEX,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const globe = new Globe(container, { animateIn: false })
      .backgroundColor('#000000')
      .backgroundImageUrl('/textures/night-sky.png')
      .globeImageUrl('/textures/earth-blue-marble.jpg')
      .bumpImageUrl('/textures/earth-topology.png')
      .showAtmosphere(true)
      .atmosphereColor('#6fa3c4')
      .atmosphereAltitude(0.18)
      .polygonsData([])
      .polygonAltitude(0.006)
      .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
      .polygonStrokeColor(() => 'rgba(250, 250, 249, 0.35)')
      .polygonsTransitionDuration(0)
      .objectLat('lat')
      .objectLng('lng')
      .objectAltitude('alt')
      .objectFacesSurface(false)
      .objectThreeObject((d) => {
        const sat = d as SatDatum
        sat.mesh = satMesh(sat.hex)
        return sat.mesh
      })
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
        if (sat && !labels.has(id)) labels.set(id, { id, el: labelElement(sat.object, sat.hex), lat: 0, lng: 0, alt: 0 })
      }
    }

    // Rings take the object's category colour (or the blinking attention colour once close);
    // the active pair's rating colour otherwise lives on the approach arc and markers.
    const ringsFor = (s: MissionState, timeMs: number): OverlayPath[] => {
      return s.trackedIds.flatMap((id) => {
        const object = rsoById.get(id)
        if (!object) return []
        return [
          {
            id,
            points: orbitRing(effectiveElements(s, object, timeMs), timeMs),
            color: withAlpha(globeHex(s, id), id === s.selectedRsoId ? 0.95 : 0.7),
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
      const attention = attentionActive(s)

      const sats = trackedSats(s)
      for (const sat of sats) {
        const geo = geoAt(effectiveElements(s, sat.object, timeMs), timeMs)
        sat.lat = geo.lat
        sat.lng = geo.lng
        sat.alt = toAlt(geo.altKm)
      }

      // Deliberately no "nudge apart when close" here: sat.lat/lng also drives labels
      // (below) and camera-follow, while the orbit ring and approach-arc overlay are
      // computed independently from these same true elements. Any adjustment applied
      // only to the marker desyncs the dot from its own ring/arc/label the moment a
      // conjunction or threat window opens — the object visibly floats off its track.
      // If two very-close objects need to read as distinct dots, that has to be a
      // purely visual nudge on the rendered mesh (e.g. sat.mesh.position, after globe.gl
      // places it) that never touches sat.lat/lng, not a change to the position itself.
      globe.objectsData(sats)

      // A slow, simple dim-bright-dim breathe on the shared attention glow material — the dot
      // underneath keeps its own owned/allied/opposed colour throughout.
      const attentionSet = new Set(attention)
      if (attentionSet.size > 0) {
        const phase = (now % ATTENTION_PERIOD_MS) / ATTENTION_PERIOD_MS
        attentionGlowMaterial.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2))
      }
      for (const sat of sats) {
        const glow = sat.mesh?.userData.glow as THREE.Sprite | undefined
        if (!glow) continue
        const want = attentionSet.has(sat.id) ? attentionGlowMaterial : (sat.mesh!.userData.categoryGlow as THREE.SpriteMaterial)
        if (glow.material !== want) glow.material = want
      }

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
      attentionGlowMaterial.map?.dispose()
      attentionGlowMaterial.dispose()
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
      // Country outlines only: transparent fill, the graticule + stroke do the work.
      globe.polygonCapColor(() => 'rgba(0, 0, 0, 0)').showGraticules(true)
      loadCountries().then((features) => {
        if (!cancelled) globe.polygonsData(features)
      })
    } else if (surface === 'political') {
      material.color = new THREE.Color(0x000000)
      material.transparent = false
      material.opacity = 1
      material.needsUpdate = true
      globe.polygonCapColor(countryColor).showGraticules(false)
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
      <SpeedControl />
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

const SPEEDS: SpeedMultiplier[] = [10, 100, 1000]

/** Mission-clock speed picker, moved off the navbar and onto the viewport it actually affects. */
function SpeedControl() {
  const speed = useMissionStore((s) => s.speed)
  const setSpeed = useMissionStore((s) => s.setSpeed)
  return (
    <div
      className="absolute bottom-3 right-3 flex overflow-hidden rounded-lg border border-glass-border bg-glass backdrop-blur-md light:shadow-lg"
      role="radiogroup"
      aria-label="Simulation speed"
    >
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={speed === s}
          onClick={() => setSpeed(s)}
          className={cn(
            'px-2.5 py-1.5 font-mono text-xs tabular-nums transition-colors duration-100 ease-out',
            speed === s ? 'bg-accent-muted text-accent' : 'text-secondary hover:bg-elevated hover:text-primary',
          )}
        >
          {s}x
        </button>
      ))}
    </div>
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
        {(Object.keys(CATEGORY_HEX) as RsoListCategory[]).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: CATEGORY_HEX[c], boxShadow: `0 0 6px 1px ${CATEGORY_HEX[c]}` }}
            />
            {CATEGORY_LABEL[c]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white shadow-[0_0_6px_2px_rgba(255,255,255,0.6)] light:shadow-none light:ring-1 light:ring-stone-400" />
          Unlisted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-[#5b9bd1] light:bg-[#2f6fa8]" />
          COLA arc
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-sev-red" />
          Intercept
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 animate-pulse rounded-full" style={{ backgroundColor: ATTENTION_HEX }} />
          Attention
        </span>
      </div>
    </div>
  )
}
