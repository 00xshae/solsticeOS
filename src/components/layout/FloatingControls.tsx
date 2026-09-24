import { Moon, RotateCcw, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useMissionStore } from '@/store/missionStore'
import { useThemeStore } from '@/store/themeStore'

const iconButton =
  'grid size-9 place-items-center rounded-lg border border-border bg-surface text-secondary shadow-sm transition-colors duration-100 ease-out hover:border-border-strong hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'

/** Reset + theme toggle, floated out of the navbar so it stays clean. */
export function FloatingControls() {
  const resetDemo = useMissionStore((s) => s.resetDemo)
  const resolved = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const themeLabel = resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5">
      <button type="button" onClick={resetDemo} title="Reset demo" aria-label="Reset demo" className={iconButton}>
        <RotateCcw className="size-4" />
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        title={themeLabel}
        aria-label={themeLabel}
        className={cn(iconButton, 'hover:border-accent/40 hover:text-accent')}
      >
        {resolved === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </button>
    </div>
  )
}
