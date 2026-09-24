import { cn } from '@/lib/cn'
import { SEVERITY_HEX } from '@/lib/format'
import { DEFAULT_THREAT_CONFIG, THREAT_FACTOR_LABEL, THREAT_FACTORS } from '@/lib/threat'
import type { SeverityBand, ThreatFactor, ThreatRating } from '@/types'

// Three steps of the band colour, lightest for the least weighted factor (as in Solstice).
const FACTOR_OPACITY: Record<ThreatFactor, number> = { cheap: 0.45, quick: 0.72, soon: 1 }

const BANDS: SeverityBand[] = ['green', 'blue', 'yellow', 'orange', 'red']

/** Band-coloured text that stays legible in light mode. */
export const BAND_TEXT: Record<SeverityBand, string> = {
  green: 'text-sev-green-ink',
  blue: 'text-sev-blue-ink',
  yellow: 'text-sev-yellow-ink',
  orange: 'text-sev-orange-ink',
  red: 'text-sev-red-ink',
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-tertiary">{children}</div>
}

export function ThreatComposition() {
  const { weights } = DEFAULT_THREAT_CONFIG
  return (
    <div>
      <SectionLabel>Composition</SectionLabel>
      <div className="text-[12px] text-secondary">
        weighted mean — cheap ×{weights.cheap}, quick ×{weights.quick}, soon ×{weights.soon}
      </div>
    </div>
  )
}

/** Stacked contribution bar and per-factor rows; contributions sum to the rating. */
export function ThreatContributions({ rating, label = 'Contributions' }: { rating: ThreatRating; label?: string }) {
  const color = SEVERITY_HEX[rating.band]
  return (
    <div>
      <SectionLabel>
        {label} (sum to {Math.round(rating.rating)})
      </SectionLabel>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-elevated" role="img" aria-label="Threat contributions">
        {THREAT_FACTORS.map((f) => (
          <div
            key={f}
            style={{ width: `${rating.terms[f].contribution}%`, backgroundColor: color, opacity: FACTOR_OPACITY[f] }}
          />
        ))}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {THREAT_FACTORS.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[12px]">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: color, opacity: FACTOR_OPACITY[f] }} />
            <span
              className={cn(
                'flex-1 font-medium uppercase tracking-wider',
                f === rating.strongest ? 'text-primary' : 'text-secondary',
              )}
            >
              {THREAT_FACTOR_LABEL[f]}
            </span>
            <span className="w-10 text-right font-mono tabular-nums text-primary">
              +{Math.round(rating.terms[f].contribution)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ThreatScale() {
  return (
    <div>
      <SectionLabel>Scale · 0 (lowest) → 100 (highest)</SectionLabel>
      <div className="flex flex-wrap gap-3 text-[11px] font-medium uppercase tracking-wider text-secondary">
        {BANDS.map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: SEVERITY_HEX[b] }} />
            {b}
          </span>
        ))}
      </div>
    </div>
  )
}
