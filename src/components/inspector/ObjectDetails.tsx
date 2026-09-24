import { X } from 'lucide-react'
import { EARTH_RADIUS_KM } from '@/lib/orbit'
import { SEGMENT_LABEL } from '@/lib/format'
import { CategoryChip } from '@/components/ui/Badge'
import { Field, Section } from '@/components/ui/Section'
import { rsoCategories, useMissionStore } from '@/store/missionStore'
import type { RSOObject } from '@/types'

const date = (iso: string | null) => (iso ? iso.slice(0, 10) : '—')

export function ObjectDetails({ object }: { object: RSOObject }) {
  const selectRso = useMissionStore((s) => s.selectRso)
  const el = object.elements
  const perigeeKm = el.smaKm * (1 - el.ecc) - EARTH_RADIUS_KM
  const apogeeKm = el.smaKm * (1 + el.ecc) - EARTH_RADIUS_KM

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-line px-3 py-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="truncate text-sm font-semibold text-ink">{object.name}</h2>
            <span className="font-mono text-[10px] text-ink-faint">NORAD {object.noradId}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {rsoCategories(object.id).map((c) => (
              <CategoryChip key={c} category={c} />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => selectRso(null)}
          aria-label="Close object details"
          className="text-ink-faint hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 px-3 py-3">
        <Field label="Type" value={SEGMENT_LABEL[object.segment]} mono={false} />
        <Field label="Country" value={object.country} />
        <Field label="RCS" value={object.rcs} />
      </div>

      <Section title="More details" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-3 px-3 py-3">
          <Field label="COSPAR ID" value={object.cosparId} />
          <Field label="Launch" value={date(object.launchDate)} />
          <Field label="Site" value={object.launchSite} />
          <Field label="Operator" value={object.operator} mono={false} />
          <Field label="Ops status" value={object.opsStatus.replace('_', '-')} />
          <Field label="TLE age" value={`${object.tleAgeHours.toFixed(1)} h`} />
          <Field label="SMA" value={`${el.smaKm.toFixed(1)} km`} />
          <Field label="ECC" value={el.ecc.toFixed(6)} />
          <Field label="INCL" value={`${el.incDeg.toFixed(2)}°`} />
          <Field label="RAAN" value={`${el.raanDeg.toFixed(2)}°`} />
          <Field label="AOP" value={`${el.argpDeg.toFixed(2)}°`} />
          <Field label="Perigee / apogee" value={`${perigeeKm.toFixed(0)} / ${apogeeKm.toFixed(0)} km`} />
        </div>
      </Section>
    </>
  )
}
