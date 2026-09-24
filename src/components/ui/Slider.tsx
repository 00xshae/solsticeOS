import { useId } from 'react'
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
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
      <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        {label}
        {modified && <span className="ml-1.5 text-sev-yellow">●</span>}
      </label>
      <output htmlFor={id} className={cn('font-mono text-xs tabular-nums', modified ? 'text-sev-yellow' : 'text-ink')}>
        {value.toFixed(digits)} <span className="text-ink-faint">{unit}</span>
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="col-span-2 h-1 w-full cursor-pointer accent-protected"
      />
    </div>
  )
}
