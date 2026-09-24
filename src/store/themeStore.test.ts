import { describe, expect, it } from 'vitest'
import { nextTheme, parseTheme, resolveTheme, useThemeStore } from './themeStore'

describe('theme', () => {
  it('defaults unknown stored values to dark', () => {
    expect(parseTheme(null)).toBe('dark')
    expect(parseTheme('sepia')).toBe('dark')
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('system')).toBe('system')
  })

  it('resolves system against the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
  })

  it('toggles to the opposite of what is showing', () => {
    expect(nextTheme('dark')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
  })

  it('cycles dark and light from the store', () => {
    useThemeStore.getState().setTheme('dark')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState()).toMatchObject({ theme: 'light', resolved: 'light' })
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState()).toMatchObject({ theme: 'dark', resolved: 'dark' })
  })
})
