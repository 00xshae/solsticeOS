import { ArrowRight } from 'lucide-react'
import { rsoById, threatWindowById } from '@/data'
import { severityBand } from '@/lib/severity'
import { describeThreat } from '@/lib/threat'
import { SeverityBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useObjectThreat, useWindowRating } from '@/hooks/useThreat'
import { useMissionStore, type RatingModalTarget } from '@/store/missionStore'
import type { ListScope, ThreatRole, ThreatWindow } from '@/types'
import { BAND_TEXT, SectionLabel, ThreatComposition, ThreatContributions, ThreatScale } from './ThreatBreakdown'

const name = (id: string) => rsoById.get(id)?.name ?? id

function Headline({ rating, caption }: { rating: number; caption: string }) {
  return (
    <div className="flex items-center gap-3">
      <SeverityBadge index={rating} size="lg" />
      <div>
        <div className={`font-mono text-lg font-semibold tabular-nums ${BAND_TEXT[severityBand(rating)]}`}>
          {Math.round(rating)}/100
        </div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-tertiary">{caption}</div>
      </div>
    </div>
  )
}

function Block({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 border-b border-border px-4 py-4 last:border-b-0">{children}</div>
}

function WindowRating({ window }: { window: ThreatWindow }) {
  const rating = useWindowRating(window)
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 font-mono text-[12px] text-secondary">
        {name(window.opposedId)} <ArrowRight className="size-3.5" /> {name(window.targetId)}
      </div>
      {rating ? (
        <>
          <Block>
            <Headline rating={rating.rating} caption="Window threat rating" />
          </Block>
          <Block>
            <p className="text-[13px] leading-relaxed text-primary">{describeThreat(rating)}</p>
            <ThreatComposition />
          </Block>
          <Block>
            <ThreatContributions rating={rating} />
          </Block>
        </>
      ) : (
        <Block>
          <p className="text-[13px] text-secondary">Window closed: every sequence's Burn 1 has passed.</p>
        </Block>
      )}
      <Block>
        <ThreatScale />
      </Block>
    </>
  )
}

const ROLE_COPY: Record<ThreatRole, { title: string; hint: string; counterpart: 'targetId' | 'opposedId' }> = {
  threatened: { title: 'Threatened', hint: 'How threatened this RSO is', counterpart: 'opposedId' },
  threatening: { title: 'Threatening', hint: 'How threatening this RSO is', counterpart: 'targetId' },
}

const SCOPE_COPY: Record<ListScope, { caption: string; empty: string }> = {
  ORG: { caption: "Org · the organisation's lists", empty: "No threat from RSOs on the organisation's lists" },
  USER: { caption: 'User · your own lists', empty: "No threat from RSOs on your own lists" },
}

function WorstContributor({ window }: { window: ThreatWindow }) {
  const rating = useWindowRating(window)
  return rating ? <ThreatContributions rating={rating} label="Worst contributor" /> : null
}

function ScopeRating({ objectId, role, scope }: { objectId: string; role: ThreatRole; scope: ListScope }) {
  const threat = useObjectThreat(objectId, role, scope)
  const counterpart = ROLE_COPY[role].counterpart

  if (!threat) {
    return (
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-tertiary">{scope} · no rating</div>
        <p className="mt-1 font-mono text-[12px] text-tertiary">{SCOPE_COPY[scope].empty}</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <Headline rating={threat.rating} caption={SCOPE_COPY[scope].caption} />
      <WorstContributor window={threatWindowById.get(threat.contributors[0]!.windowId)!} />
      <div>
        <SectionLabel>Contributing objects · worst first</SectionLabel>
        <ul className="space-y-1">
          {threat.contributors.map((c) => (
            <li key={c.windowId} className="flex items-center gap-2 font-mono text-[12px] text-primary">
              <SeverityBadge index={c.rating} />
              {name(threatWindowById.get(c.windowId)![counterpart])}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ObjectRating({ objectId, role }: { objectId: string; role: ThreatRole }) {
  const copy = ROLE_COPY[role]
  return (
    <>
      <div className="border-b border-border px-4 py-2.5 font-mono text-[12px] text-secondary">{name(objectId)}</div>
      <Block>
        <div className="flex items-baseline gap-2">
          <h3 className="text-[14px] font-semibold uppercase tracking-wider text-primary">{copy.title}</h3>
          <span className="text-[10px] uppercase tracking-wider text-tertiary">{copy.hint}</span>
        </div>
        <ScopeRating objectId={objectId} role={role} scope="ORG" />
        <ScopeRating objectId={objectId} role={role} scope="USER" />
      </Block>
      <Block>
        <p className="text-[13px] leading-relaxed text-secondary">
          An RSO can hold more than one rating. <b className="text-primary">Org</b> aggregates threats from the
          organisation's lists, <b className="text-primary">User</b> from your own; <b className="text-primary">Threatened</b>{' '}
          is how threatened it is, <b className="text-primary">Threatening</b> how threatening — each shown only when a
          corresponding opposing list exists.
        </p>
      </Block>
      <Block>
        <ThreatScale />
      </Block>
    </>
  )
}

function Body({ target }: { target: RatingModalTarget }) {
  if (target.kind === 'window') {
    const window = threatWindowById.get(target.windowId)
    return window ? <WindowRating window={window} /> : null
  }
  return <ObjectRating objectId={target.objectId} role={target.role} />
}

export function ThreatRatingModal() {
  const target = useMissionStore((s) => s.ratingModal)
  const close = useMissionStore((s) => s.openRatingModal)
  if (!target) return null
  return (
    <Modal title="Threat rating" onClose={() => close(null)} className="max-w-xl">
      <Body target={target} />
    </Modal>
  )
}
