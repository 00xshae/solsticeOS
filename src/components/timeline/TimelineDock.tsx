import { selectActiveThreatWindow, useMissionStore } from '@/store/missionStore'
import { InterceptTimeline } from './InterceptTimeline'
import { ManeuverTimeline } from './ManeuverTimeline'

/** Timeline under the globe: the chaser's intercept for a threat window, else the COLA plan. */
export function TimelineDock() {
  const threatWindow = useMissionStore(selectActiveThreatWindow)
  return threatWindow ? <InterceptTimeline window={threatWindow} /> : <ManeuverTimeline />
}
