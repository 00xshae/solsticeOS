// Colour theme, kept apart from the mission store so "Reset demo" leaves it alone.
// The choice persists in localStorage; index.html applies it before first paint.
import { useEffect } from 'react'
import { create } from 'zustand'

export type Theme = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'orbital-rakshak-theme'
const TRANSITION_MS = 200

export const parseTheme = (value: unknown): Theme =>
  value === 'light' || value === 'dark' || value === 'system' ? value : 'dark'

export const resolveTheme = (theme: Theme, prefersLight: boolean): ResolvedTheme =>
  theme === 'system' ? (prefersLight ? 'light' : 'dark') : theme

/** The toggle flips whatever is showing, so from "system" it lands on the opposite fixed theme. */
export const nextTheme = (resolved: ResolvedTheme): Theme => (resolved === 'dark' ? 'light' : 'dark')

const lightQuery = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null

function readStoredTheme(): Theme {
  try {
    return parseTheme(globalThis.localStorage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'dark'
  }
}

interface ThemeStore {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  /** Re-resolve a "system" theme after the OS preference changes. */
  syncSystem: () => void
}

export const useThemeStore = create<ThemeStore>()((set, get) => {
  const initial = readStoredTheme()
  return {
    theme: initial,
    resolved: resolveTheme(initial, lightQuery()?.matches ?? false),
    setTheme: (theme) => {
      try {
        globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme)
      } catch {
        // Storage can be unavailable (private mode); the theme still applies for this session.
      }
      set({ theme, resolved: resolveTheme(theme, lightQuery()?.matches ?? false) })
    },
    toggleTheme: () => get().setTheme(nextTheme(get().resolved)),
    syncSystem: () => set((s) => ({ resolved: resolveTheme(s.theme, lightQuery()?.matches ?? false) })),
  }
})

/** Mirrors the resolved theme onto <html class="light">, cross-fading colours on change. */
export function useApplyTheme() {
  const resolved = useThemeStore((s) => s.resolved)
  const syncSystem = useThemeStore((s) => s.syncSystem)

  useEffect(() => {
    const root = document.documentElement
    if (root.classList.contains('light') === (resolved === 'light')) return
    root.classList.add('theme-transition')
    root.classList.toggle('light', resolved === 'light')
    const timer = window.setTimeout(() => root.classList.remove('theme-transition'), TRANSITION_MS)
    return () => {
      window.clearTimeout(timer)
      root.classList.remove('theme-transition')
    }
  }, [resolved])

  useEffect(() => {
    const query = lightQuery()
    query?.addEventListener('change', syncSystem)
    return () => query?.removeEventListener('change', syncSystem)
  }, [syncSystem])
}
