import { useId, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'

/** Labelled range input with a live value readout; `modified` highlights analyst overrides. */
export function Slider({
  label,
  unit,
  value,
  min,
  max,
  step,
  digits = 1,
  modified = false,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  digits?: number
  modified?: boolean
  onChange: (value: number) => void
}) {
  const id = useId()
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
      <label htmlFor={id} className="text-[10px] font-medium uppercase tracking-widest text-secondary">
        {label}
        {modified && <span className="ml-1.5 text-sev-yellow-ink">●</span>}
      </label>
      <output
        htmlFor={id}
        className={cn('font-mono text-xs font-medium tabular-nums', modified ? 'text-sev-yellow-ink' : 'text-primary')}
      >
        {value.toFixed(digits)} <span className="font-normal text-tertiary">{unit}</span>
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        className="range col-span-2 h-3.5 w-full cursor-pointer"
      />
    </div>
  )
}
