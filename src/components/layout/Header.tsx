import { Pause, Play, RotateCcw, Satellite } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatUtc } from '@/lib/format'
import { Pill } from '@/components/ui/Badge'
import { useMissionStore, type SpeedMultiplier } from '@/store/missionStore'

const SPEEDS: SpeedMultiplier[] = [1, 10, 60]

function MissionClock() {
  // Re-render on whole seconds only; the store ticks every frame.
  const second = useMissionStore((s) => Math.floor(s.simTimeMs / 1000))
  const playing = useMissionStore((s) => s.playing)
  const speed = useMissionStore((s) => s.speed)
  const togglePlaying = useMissionStore((s) => s.togglePlaying)
  const setSpeed = useMissionStore((s) => s.setSpeed)

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">Mission clock</div>
        <div className="font-mono text-sm tabular-nums text-ink">
          {formatUtc(second * 1000)} <span className="text-ink-faint">UTC</span>
        </div>
      </div>
      <button
        type="button"
        onClick={togglePlaying}
        aria-label={playing ? 'Pause mission clock' : 'Resume mission clock'}
        className="grid size-8 place-items-center rounded border border-line text-ink-muted hover:border-protected hover:text-protected"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="flex overflow-hidden rounded border border-line" role="group" aria-label="Clock speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            className={cn(
              'px-2.5 py-1 font-mono text-xs tabular-nums',
              speed === s ? 'bg-protected/15 text-protected' : 'text-ink-muted hover:text-ink',
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}

export function Header() {
  const resetDemo = useMissionStore((s) => s.resetDemo)
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-6 border-b border-line bg-panel px-4">
      <div className="flex items-center gap-3">
        <div className="grid size-8 place-items-center rounded bg-protected/10 text-protected">
          <Satellite className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-[0.2em] text-ink">ORBITAL RAKSHAK</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            IN-SPACe STM Platform · Conjunction Risk Analytics
          </div>
        </div>
      </div>

      <div className="hidden items-center gap-2 lg:flex">
        <Pill tone="ok">UDA Data Feed: Green</Pill>
        <Pill tone="info">ML Propagator: Active</Pill>
      </div>

      <div className="flex items-center gap-3">
        <MissionClock />
        <button
          type="button"
          onClick={resetDemo}
          title="Reset demo"
          aria-label="Reset demo"
          className="grid size-8 place-items-center rounded border border-line text-ink-muted hover:text-ink"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>
    </header>
  )
}
