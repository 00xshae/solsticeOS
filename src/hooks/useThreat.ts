import { useMemo } from 'react'
import {
  selectEstablishedWindows,
  selectObjectThreat,
  selectWindowRating,
  useMissionStore,
} from '@/store/missionStore'
import type { ListScope, ThreatRole, ThreatWindow } from '@/types'
import { useDisplayMinute } from './useSeverity'

/** Windows screened by the current lists; recomputed only when the lists change. */
export function useEstablishedWindows() {
  const lists = useMissionStore((s) => s.lists)
  return useMemo(() => selectEstablishedWindows(useMissionStore.getState()), [lists])
}

/** A window's rating at the displayed minute; null once every sequence has expired. */
export function useWindowRating(window: ThreatWindow) {
  const minute = useDisplayMinute()
  return useMemo(() => selectWindowRating(useMissionStore.getState(), window), [window, minute])
}

export function useObjectThreat(objectId: string, role: ThreatRole, scope?: ListScope) {
  const minute = useDisplayMinute()
  const lists = useMissionStore((s) => s.lists)
  return useMemo(
    () => selectObjectThreat(useMissionStore.getState(), objectId, role, scope),
    [objectId, role, scope, minute, lists],
  )
}
