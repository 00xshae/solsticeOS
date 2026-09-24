import { Hexagon, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatUtc } from '@/lib/format'
import { Pill } from '@/components/ui/Badge'
import { useMissionStore, type SpeedMultiplier } from '@/store/missionStore'
import { useThemeStore } from '@/store/themeStore'
import { ViewTabs } from './ViewTabs'

const SPEEDS: SpeedMultiplier[] = [1, 10, 60]

const iconButton =
  'grid size-8 place-items-center rounded-lg border border-border text-secondary transition-colors duration-100 ease-out hover:border-border-strong hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'

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
      <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Clock speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            className={cn(
              'px-2.5 py-1 font-mono text-xs tabular-nums transition-colors duration-100 ease-out',
              speed === s ? 'bg-accent-muted text-accent' : 'text-secondary hover:bg-elevated hover:text-primary',
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}

function ThemeToggle() {
  const resolved = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const label = resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <button type="button" onClick={toggleTheme} title={label} aria-label={label} className={iconButton}>
      {resolved === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  )
}

export function Header() {
  const resetDemo = useMissionStore((s) => s.resetDemo)
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-6 border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <Hexagon className="size-5 text-accent" strokeWidth={1.75} aria-hidden />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-[0.15em] text-primary">ORBITAL RAKSHAK</div>
          <div className="text-[11px] text-tertiary">IN-SPACe STM Platform · Conjunction Risk Analytics</div>
        </div>
        <div className="ml-4">
          <ViewTabs />
        </div>
      </div>

      <div className="hidden items-center gap-2 xl:flex">
        <Pill tone="ok">UDA Data Feed: Green</Pill>
        <Pill tone="info">ML Propagator: Active</Pill>
      </div>

      <div className="flex items-center gap-3">
        <MissionClock />
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={resetDemo} title="Reset demo" aria-label="Reset demo" className={iconButton}>
            <RotateCcw className="size-4" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
