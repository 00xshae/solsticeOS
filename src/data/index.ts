// Typed access to the deterministic demo datasets.
// JSON imports widen string unions to `string`, so the casts below are checked by
// src/data/data.test.ts rather than by the compiler.
import catalogJson from './catalog.json'
import conjunctionsJson from './conjunctions.json'
import sequencesJson from './maneuverSequences.json'
import threatsJson from './threats.json'
import type { ConjunctionEvent, InterceptSequence, ManeuverSequence, RSOList, RSOObject, ThreatWindow } from '@/types'

export const DEMO_EPOCH_MS = Date.parse(catalogJson.demoEpoch)

export const rsoObjects = catalogJson.objects as RSOObject[]
export const rsoLists = catalogJson.lists as RSOList[]
export const conjunctions = conjunctionsJson.events as ConjunctionEvent[]
export const maneuverSequences = sequencesJson.sequences as ManeuverSequence[]
export const threatWindows = threatsJson.windows as ThreatWindow[]
export const interceptSequences = threatsJson.sequences as InterceptSequence[]

const index = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]))

export const rsoById = index(rsoObjects)
export const conjunctionById = index(conjunctions)
export const sequenceById = index(maneuverSequences)
export const threatWindowById = index(threatWindows)
export const interceptSequenceById = index(interceptSequences)

/** A window's intercept sequences, in generation order (by Burn 1). */
export const sequencesOfWindow = new Map(
  threatWindows.map((w) => [w.id, w.sequenceIds.map((id) => interceptSequenceById.get(id)!)]),
)
