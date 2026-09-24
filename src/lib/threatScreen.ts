// List-driven threat screening. A threat window only counts once its target sits in an owned
// or allied list and its chaser sits in an opposed list: the lists are the mechanism, not just
// labels. Ratings can be drawn from the organisation's lists, the analyst's own, or both.
import { sequencesOfWindow, threatWindows } from '@/data'
import type { ListScope, RSOList, RsoListCategory, ThreatLogEntry, ThreatLogReason, ThreatRole, ThreatWindow } from '@/types'
import { DEFAULT_THREAT_CONFIG, rateObject, rateWindow, type RatedWindow } from './threat'

const inScope = (list: RSOList, scope?: ListScope) => !scope || list.scope === scope

export function categoriesOf(lists: RSOList[], objectId: string, scope?: ListScope): Set<RsoListCategory> {
  return new Set(lists.filter((l) => inScope(l, scope) && l.memberIds.includes(objectId)).map((l) => l.category))
}

/** Roles an object can hold: threatened when owned or allied, threatening when opposed. */
export function rolesOf(lists: RSOList[], objectId: string, scope?: ListScope): ThreatRole[] {
  const categories = categoriesOf(lists, objectId, scope)
  const roles: ThreatRole[] = []
  if (categories.has('owned') || categories.has('allied')) roles.push('threatened')
  if (categories.has('opposed')) roles.push('threatening')
  return roles
}

export function isWindowEstablished(lists: RSOList[], window: ThreatWindow, scope?: ListScope): boolean {
  return rolesOf(lists, window.targetId, scope).includes('threatened') && rolesOf(lists, window.opposedId, scope).includes('threatening')
}

export const establishedWindows = (lists: RSOList[], scope?: ListScope) =>
  threatWindows.filter((w) => isWindowEstablished(lists, w, scope))

export const windowRating = (window: ThreatWindow, nowMs: number) => rateWindow(sequencesOfWindow.get(window.id)!, nowMs)

/** An object's rating in one role: the worst open window it takes part in. */
export function objectThreat(lists: RSOList[], objectId: string, role: ThreatRole, nowMs: number, scope?: ListScope) {
  const key = role === 'threatened' ? 'targetId' : 'opposedId'
  const rated: RatedWindow[] = establishedWindows(lists, scope)
    .filter((w) => w[key] === objectId)
    .flatMap((w) => {
      const r = windowRating(w, nowMs)
      return r ? [{ windowId: w.id, rating: r.rating }] : []
    })
  return rateObject(rated)
}

export type LoggedRatings = Record<string, number | null>

const logKey = (objectId: string, role: ThreatRole) => `${objectId}:${role}`

/**
 * Re-rates every listed object (across all list scopes) and returns log entries for those
 * whose rounded rating changed, plus any `focusIds` whose membership just changed. Ratings
 * are rounded, as displayed, so the log only moves when the badge would.
 */
export function assessThreats(
  lists: RSOList[],
  previous: LoggedRatings,
  nowMs: number,
  reason: ThreatLogReason,
  focusIds: string[] = [],
): { entries: Omit<ThreatLogEntry, 'id'>[]; ratings: LoggedRatings } {
  const listed = new Set(lists.flatMap((l) => l.memberIds))
  const candidates = new Set([...listed, ...focusIds, ...Object.keys(previous).map((k) => k.split(':')[0]!)])
  const ratings: LoggedRatings = {}
  const entries: Omit<ThreatLogEntry, 'id'>[] = []

  for (const objectId of candidates) {
    for (const role of ['threatened', 'threatening'] as const) {
      const key = logKey(objectId, role)
      const threat = objectThreat(lists, objectId, role, nowMs)
      const rating = threat ? Math.round(threat.rating) : null
      const before = key in previous ? previous[key]! : undefined
      if (rating !== null || before !== undefined) ratings[key] = rating
      const changed = before === undefined ? rating !== null : before !== rating
      const focused = focusIds.includes(objectId) && (rating !== null || (before ?? null) !== null)
      if (!changed && !focused) continue
      entries.push({
        objectId,
        role,
        reason,
        recordedAt: new Date(nowMs).toISOString(),
        previous: before ?? null,
        rating,
        contributors: (threat?.contributors ?? []).map((c) => ({ windowId: c.windowId, rating: Math.round(c.rating) })),
        config: DEFAULT_THREAT_CONFIG,
      })
    }
  }
  // Drop keys that no longer rate and never did, keeping the map small.
  for (const [key, value] of Object.entries(ratings)) if (value === null && previous[key] == null) delete ratings[key]
  return { entries, ratings }
}
