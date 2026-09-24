import { describe, expect, it } from 'vitest'
import { DEMO_EPOCH_MS, rsoLists, threatWindowById } from '@/data'
import type { RSOList } from '@/types'
import { assessThreats, establishedWindows, isWindowEstablished, objectThreat, rolesOf } from './threatScreen'

const HOUR = 3_600_000
const risat = threatWindowById.get('TW-RISAT2B-INSP2')!
const userOpposed = (ids: string[]): RSOList => ({ id: 'U1', name: 'OPPOSED INSPECTOR 2', category: 'opposed', scope: 'USER', memberIds: ids })

describe('screening', () => {
  it('establishes Cartosat-3 and SPADEX from the org lists, but not RISAT-2B yet', () => {
    expect(establishedWindows(rsoLists).map((w) => w.id).sort()).toEqual(['TW-CARTOSAT-INSP1', 'TW-SPADEX'])
  })

  it('establishes a window once the chaser joins an opposed list, in that list scope only', () => {
    const lists = [...rsoLists, userOpposed(['INSP-2'])]
    expect(isWindowEstablished(lists, risat)).toBe(true)
    expect(isWindowEstablished(lists, risat, 'USER')).toBe(false) // RISAT-2B is only in an ORG list
    expect(isWindowEstablished(lists, risat, 'ORG')).toBe(false)
  })

  it('assigns threatened to owned or allied objects and threatening to opposed ones', () => {
    expect(rolesOf(rsoLists, 'CARTOSAT-3')).toEqual(['threatened'])
    expect(rolesOf(rsoLists, 'INSP-1')).toEqual(['threatening'])
    expect(rolesOf(rsoLists, 'INSP-2')).toEqual([])
  })

  it('rates an object as its worst open window', () => {
    const threatened = objectThreat(rsoLists, 'CARTOSAT-3', 'threatened', DEMO_EPOCH_MS)!
    const threatening = objectThreat(rsoLists, 'INSP-1', 'threatening', DEMO_EPOCH_MS)!
    expect(threatened.rating).toBeGreaterThan(80)
    expect(threatening.rating).toBe(threatened.rating)
    expect(threatened.contributors.map((c) => c.windowId)).toEqual(['TW-CARTOSAT-INSP1'])
    expect(objectThreat(rsoLists, 'CARTOSAT-3', 'threatening', DEMO_EPOCH_MS)).toBeNull()
  })
})

describe('threat log assessment', () => {
  it('records a first rating for every rated object', () => {
    const { entries, ratings } = assessThreats(rsoLists, {}, DEMO_EPOCH_MS, 'REASSESSED')
    expect(entries.map((e) => `${e.objectId}:${e.role}`).sort()).toEqual([
      'CARTOSAT-3:threatened',
      'INSP-1:threatening',
      'SDX01:threatening',
      'SDX02:threatened',
    ])
    expect(entries.every((e) => e.previous === null && e.rating !== null)).toBe(true)
    expect(ratings['CARTOSAT-3:threatened']).toBe(entries.find((e) => e.objectId === 'CARTOSAT-3')!.rating)
  })

  it('logs only rounded changes on reassessment', () => {
    const first = assessThreats(rsoLists, {}, DEMO_EPOCH_MS, 'REASSESSED')
    const same = assessThreats(rsoLists, first.ratings, DEMO_EPOCH_MS + 60_000, 'REASSESSED')
    expect(same.entries).toEqual([])
    const later = assessThreats(rsoLists, first.ratings, DEMO_EPOCH_MS + 12 * HOUR, 'REASSESSED')
    expect(later.entries.length).toBeGreaterThan(0)
    for (const e of later.entries) expect(e.rating!).toBeGreaterThan(e.previous!)
  })

  it('logs both objects of a window when its chaser is added, and a drop to no rating on removal', () => {
    const base = assessThreats(rsoLists, {}, DEMO_EPOCH_MS, 'REASSESSED').ratings
    const added = assessThreats([...rsoLists, userOpposed(['INSP-2'])], base, DEMO_EPOCH_MS, 'MEMBER_ADDED', ['INSP-2'])
    expect(added.entries.map((e) => `${e.objectId}:${e.role}:${e.previous}`).sort()).toEqual([
      'INSP-2:threatening:null',
      'RISAT-2B:threatened:null',
    ])
    const removed = assessThreats(rsoLists, added.ratings, DEMO_EPOCH_MS, 'MEMBER_REMOVED', ['INSP-2'])
    expect(removed.entries.map((e) => `${e.objectId}:${e.rating}`).sort()).toEqual(['INSP-2:null', 'RISAT-2B:null'])
    expect(removed.entries.every((e) => e.reason === 'MEMBER_REMOVED')).toBe(true)
  })

  it('records a membership change even when the rating is unchanged', () => {
    const base = assessThreats(rsoLists, {}, DEMO_EPOCH_MS, 'REASSESSED').ratings
    const again = assessThreats([...rsoLists, userOpposed(['INSP-1'])], base, DEMO_EPOCH_MS, 'MEMBER_ADDED', ['INSP-1'])
    expect(again.entries).toHaveLength(1)
    expect(again.entries[0]).toMatchObject({ objectId: 'INSP-1', reason: 'MEMBER_ADDED' })
    expect(again.entries[0]!.previous).toBe(again.entries[0]!.rating)
  })
})
