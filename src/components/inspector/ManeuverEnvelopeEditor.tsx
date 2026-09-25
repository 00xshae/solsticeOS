import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { conjunctions, maneuverSequences } from '@/data'
import { cn } from '@/lib/cn'
import { burnSecondsPerMps, propellantForDeltaV } from '@/lib/propulsion'
import { Field, Section } from '@/components/ui/Section'
import { Slider } from '@/components/ui/Slider'
import { selectEffectiveEnvelope, selectSequenceFeasibility, useMissionStore } from '@/store/missionStore'
import type { ManeuverEnvelope, RSOObject } from '@/types'

type NumericField = 'deltaVRemainingMps' | 'thrustN' | 'ispS' | 'massKg'

const DEFAULT_SCREENING_RADIUS_KM = 5

function ScreeningRadiusSlider() {
  const override = useMissionStore((s) => s.screeningRadiusOverrideKm)
  const setScreeningRadius = useMissionStore((s) => s.setScreeningRadius)
  return (
    <Slider
      label="Screening radius (all)"
      unit="km"
      value={override ?? DEFAULT_SCREENING_RADIUS_KM}
      min={0.5}
      max={10}
      step={0.5}
      modified={override !== null}
      onChange={(v) => setScreeningRadius(v === DEFAULT_SCREENING_RADIUS_KM ? null : v)}
    />
  )
}

/** How many COLA plans across this object's conjunctions still fit the edited envelope. */
function PlanImpact({ objectId }: { objectId: string }) {
  const [feasible, total] = useMissionStore((s) => {
    const ids = new Set(conjunctions.filter((e) => e.primaryId === objectId).map((e) => e.id))
    const plans = maneuverSequences.filter((q) => ids.has(q.conjunctionId))
    // Encode as a number pair in one primitive so the selector result compares by value.
    return `${plans.filter((q) => selectSequenceFeasibility(s, q)?.feasible).length}/${plans.length}`
  })
    .split('/')
    .map(Number) as [number, number]
  if (!total) return null
  return (
    <p className={cn('text-[11px] font-medium', feasible < total ? 'text-sev-orange-ink' : 'text-sev-green-ink')}>
      <span className="font-mono tabular-nums">{feasible}</span> of <span className="font-mono tabular-nums">{total}</span> COLA plans
      within envelope
    </p>
  )
}

export function ManeuverEnvelopeEditor({ object }: { object: RSOObject }) {
  const base = object.envelope
  // Merged envelope is a fresh object per call; compare field-by-field to avoid a render loop.
  const effective = useMissionStore(useShallow((s) => selectEffectiveEnvelope(s, object.id)))
  const overrides = useMissionStore((s) => s.envelopeOverrides[object.id])
  const setEnvelopeOverride = useMissionStore((s) => s.setEnvelopeOverride)
  const resetEnvelope = useMissionStore((s) => s.resetEnvelope)

  if (!base || !effective) {
    return (
      <Section
        title="Maneuver envelope"
        info="The propulsion budget used to test whether a manoeuvre plan is feasible for this object."
      >
        <div className="space-y-3 px-3 py-3">
          <p className="flex gap-2 text-[12px] leading-relaxed text-secondary">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-sev-yellow-ink" />
            No propulsion on record. This object cannot execute collision avoidance, so its conjunctions
            are monitor-only.
          </p>
          <ScreeningRadiusSlider />
        </div>
      </Section>
    )
  }

  const set = (field: NumericField) => (value: number) => setEnvelopeOverride(object.id, { [field]: value })
  const isModified = (field: keyof ManeuverEnvelope) =>
    overrides?.[field] !== undefined && overrides[field] !== base[field]
  const propellantKg = propellantForDeltaV(effective.deltaVRemainingMps, effective.massKg, effective.ispS)

  return (
    <Section
      title="Maneuver envelope"
      info="The propulsion budget used to test whether a manoeuvre plan is feasible. Overrides here are local to this session and affect COLA plan feasibility."
      aside={
        overrides && (
          <button
            type="button"
            onClick={() => resetEnvelope(object.id)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-tertiary transition-colors duration-100 hover:bg-elevated hover:text-primary"
          >
            <RotateCcw className="size-3" /> Reset
          </button>
        )
      }
    >
      <div className="space-y-4 px-3 py-3">
        <Slider
          label="Δv remaining"
          unit="m/s"
          value={effective.deltaVRemainingMps}
          min={0}
          max={base.deltaVBudgetMps}
          step={base.deltaVBudgetMps / 200}
          digits={2}
          modified={isModified('deltaVRemainingMps')}
          onChange={set('deltaVRemainingMps')}
        />
        <Slider
          label="Thrust"
          unit="N"
          value={effective.thrustN}
          min={base.thrustN * 0.1}
          max={base.thrustN * 3}
          step={base.thrustN / 100}
          digits={base.thrustN < 1 ? 3 : 1}
          modified={isModified('thrustN')}
          onChange={set('thrustN')}
        />
        <Slider
          label="Specific impulse"
          unit="s"
          value={effective.ispS}
          min={Math.round(base.ispS * 0.5)}
          max={Math.round(base.ispS * 1.5)}
          step={1}
          digits={0}
          modified={isModified('ispS')}
          onChange={set('ispS')}
        />
        <Slider
          label="Wet mass"
          unit="kg"
          value={effective.massKg}
          min={base.massKg * 0.5}
          max={base.massKg * 1.5}
          step={base.massKg / 200}
          digits={base.massKg < 100 ? 1 : 0}
          modified={isModified('massKg')}
          onChange={set('massKg')}
        />
        <ScreeningRadiusSlider />

        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-base/60 p-2.5">
          <Field label="Propulsion" value={effective.propulsion} mono={false} />
          <Field label="Propellant" value={`${propellantKg.toFixed(propellantKg < 10 ? 2 : 1)} kg`} />
          <Field label="Burn / 1 m/s" value={`${burnSecondsPerMps(effective).toFixed(0)} s`} />
        </div>
        <PlanImpact objectId={object.id} />
        <p className="text-[10px] text-tertiary">Overrides stay local to this analyst session.</p>
      </div>
    </Section>
  )
}
