import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatUtc } from '@/lib/format'
import { useMissionStore } from '@/store/missionStore'
import { ViewTabs } from './ViewTabs'

const iconButton =
  'grid size-8 place-items-center rounded-lg border border-border text-secondary transition-colors duration-100 ease-out hover:border-border-strong hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'

function MissionClock() {
  // Re-render on whole seconds only; the store ticks every frame.
  const second = useMissionStore((s) => Math.floor(s.simTimeMs / 1000))
  const playing = useMissionStore((s) => s.playing)
  const togglePlaying = useMissionStore((s) => s.togglePlaying)

  return (
    <div className="flex items-center gap-3">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-widest text-tertiary">Mission clock</div>
        <div className="font-mono text-sm font-medium tabular-nums text-primary">
          {formatUtc(second * 1000)} <span className="font-normal text-tertiary">UTC</span>
        </div>
      </div>
      <button
        type="button"
        onClick={togglePlaying}
        aria-label={playing ? 'Pause mission clock' : 'Resume mission clock'}
        className={cn(iconButton, 'hover:border-accent/40 hover:text-accent')}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </div>
  )
}

export function Header() {
  return (
    <header className="relative grid h-14 shrink-0 grid-cols-3 items-center bg-glass px-4 backdrop-blur-md">
      <div className="flex items-center">
        <MissionClock />
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="glow size-1.5 rounded-full bg-accent [--glow:var(--color-accent)]" aria-hidden />
        <div className="font-display text-lg leading-none tracking-wide text-primary [font-variant-caps:small-caps]">
          orbital rakshak
        </div>
      </div>

      <div className="flex items-center justify-end">
        <ViewTabs />
      </div>

      {/* Gradient hairline instead of a flat border — reads as a lit console edge, not a divider. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"
        aria-hidden
      />
    </header>
  )
}
