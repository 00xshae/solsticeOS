import { useShallow } from 'zustand/react/shallow'
import { selectCategories, useMissionStore } from '@/store/missionStore'

/** An object's list categories; re-renders when list membership changes. */
export const useCategories = (objectId: string) => useMissionStore(useShallow((s) => selectCategories(s, objectId)))
