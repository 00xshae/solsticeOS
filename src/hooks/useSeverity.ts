import { useMemo } from 'react'
import {
  selectAggregateSeverity,
  selectDisplayTimeMs,
  selectSeverity,
  useMissionStore,
} from '@/store/missionStore'
import type { ConjunctionEvent } from '@/types'

/**
 * Displayed time bucketed to whole minutes. The store ticks every frame, but severity
 * moves slowly, so components keyed on this re-render at most once per displayed minute.
 */
export const useDisplayMinute = () => useMissionStore((s) => Math.floor(selectDisplayTimeMs(s) / 60_000))

const useSeverityInputs = () => {
  const minute = useDisplayMinute()
  const radius = useMissionStore((s) => s.screeningRadiusOverrideKm)
  return [minute, radius] as const
}

export function useSeverity(event: ConjunctionEvent) {
  const [minute, radius] = useSeverityInputs()
  // minute and radius are the only state selectSeverity reads besides the event.
  return useMemo(() => selectSeverity(useMissionStore.getState(), event), [event, minute, radius])
}

export function useAggregateSeverity(objectId: string, role: 'vulnerable' | 'endangering' | null) {
  const [minute, radius] = useSeverityInputs()
  return useMemo(
    () => (role ? selectAggregateSeverity(useMissionStore.getState(), objectId, role) : null),
    [objectId, role, minute, radius],
  )
}
