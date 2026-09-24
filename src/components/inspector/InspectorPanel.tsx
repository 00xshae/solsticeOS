import { useMemo } from 'react'
import { conjunctions } from '@/data'
import { Section } from '@/components/ui/Section'
import { selectActiveConjunction, selectSelectedRso, useMissionStore } from '@/store/missionStore'
import { ConjunctionCard } from './ConjunctionCard'
import { ConjunctionList } from './ConjunctionList'
import { ManeuverEnvelopeEditor } from './ManeuverEnvelopeEditor'
import { ObjectDetails } from './ObjectDetails'
import { ResponseOptions } from './ResponseOptions'

/**
 * Right-hand inspector. With nothing selected it lists every conjunction window; selecting an
 * object adds its details, envelope editor and windows; selecting a window adds its CSI card.
 */
export function InspectorPanel() {
  const object = useMissionStore(selectSelectedRso)
  const conjunction = useMissionStore(selectActiveConjunction)

  const objectEvents = useMemo(
    () => (object ? conjunctions.filter((e) => e.primaryId === object.id || e.secondaryId === object.id) : conjunctions),
    [object],
  )

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface" aria-label="Inspector">
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
      <Section title={object ? `Conjunction windows · ${objectEvents.length}` : 'Conjunction windows'}>
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
