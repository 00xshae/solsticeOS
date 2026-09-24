import { useEffect } from 'react'
import { useMissionStore } from '@/store/missionStore'

/** Drives the simulated mission clock from requestAnimationFrame. Mount once. */
export function useMissionClock() {
  const tick = useMissionStore((s) => s.tick)
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      tick(now - last)
      last = now
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [tick])
}
