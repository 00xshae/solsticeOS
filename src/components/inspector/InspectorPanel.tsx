import { useMemo } from 'react'
import { conjunctions } from '@/data'
import { Section } from '@/components/ui/Section'
import { ThreatLog } from '@/components/threat/ThreatLog'
import { ThreatWindowCard } from '@/components/threat/ThreatWindowCard'
import { ThreatWindowList } from '@/components/threat/ThreatWindowList'
import { useEstablishedWindows } from '@/hooks/useThreat'
import {
  selectActiveConjunction,
  selectActiveThreatWindow,
  selectSelectedRso,
  useMissionStore,
} from '@/store/missionStore'
import { ConjunctionCard } from './ConjunctionCard'
import { ConjunctionList } from './ConjunctionList'
import { ManeuverEnvelopeEditor } from './ManeuverEnvelopeEditor'
import { ObjectDetails } from './ObjectDetails'
import { ResponseOptions } from './ResponseOptions'

/**
 * Right-hand inspector. With nothing selected it lists threat windows, the threat log and
 * conjunction windows; selecting an object narrows them to it and adds its details; opening a
 * threat window or conjunction adds its card on top.
 */
export function InspectorPanel() {
  const object = useMissionStore(selectSelectedRso)
  const conjunction = useMissionStore(selectActiveConjunction)
  const threatWindow = useMissionStore(selectActiveThreatWindow)
  const established = useEstablishedWindows()

  const objectEvents = useMemo(
    () => (object ? conjunctions.filter((e) => e.primaryId === object.id || e.secondaryId === object.id) : conjunctions),
    [object],
  )
  const objectWindows = useMemo(
    () => (object ? established.filter((w) => w.targetId === object.id || w.opposedId === object.id) : established),
    [object, established],
  )

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface" aria-label="Inspector">
      {threatWindow && <ThreatWindowCard key={threatWindow.id} window={threatWindow} />}
      {conjunction && (
        <>
          <ConjunctionCard key={conjunction.id} event={conjunction} />
          <ResponseOptions event={conjunction} />
        </>
      )}
      {object && (
        <>
          <ObjectDetails object={object} />
          <ManeuverEnvelopeEditor key={object.id} object={object} />
        </>
      )}
      <Section title={object ? `Threat windows · ${objectWindows.length}` : `Threat windows · ${established.length}`}>
        {!object && (
          <p className="px-3 pt-2.5 text-[12px] leading-relaxed text-secondary">
            Calculated only once an object sits in an owned or allied list and another in an opposed list. Tap a
            rating to see how it is built.
          </p>
        )}
        <ThreatWindowList
          windows={objectWindows}
          emptyText="No threat windows. Add it to an owned, allied or opposed list with a counterpart to screen it."
        />
      </Section>
      <Section title="Threat log">
        <ThreatLog objectId={object?.id} />
      </Section>
      <Section title={object ? `Conjunction windows · ${objectEvents.length}` : 'Conjunction windows'} defaultOpen={!threatWindow}>
        {!object && (
          <p className="px-3 pt-2.5 text-[12px] leading-relaxed text-secondary">
            Screened only for owned × opposed pairs. Select a window to inspect its severity.
          </p>
        )}
        <ConjunctionList
          events={objectEvents}
          emptyText="Not in any screened pair. Add it to an owned or opposed list to screen it."
        />
      </Section>
    </aside>
  )
}
