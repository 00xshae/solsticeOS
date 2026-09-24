import { useMemo, useState } from 'react'
import { CheckCircle2, Download, FileJson, ShieldAlert, XCircle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { rsoById } from '@/data'
import { cn } from '@/lib/cn'
import { buildComplianceReport, complianceFileName } from '@/lib/compliance'
import { formatUtc } from '@/lib/format'
import { Button, Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Section'
import {
  selectActiveConjunction,
  selectActiveSequence,
  selectEffectiveEnvelope,
  useMissionStore,
} from '@/store/missionStore'
import type { ComplianceFormat, ComplianceReport } from '@/types'

const PREVIEW_LINES = 40

const FORMATS: { id: ComplianceFormat; label: string; hint: string }[] = [
  { id: 'CCSDS_OEM', label: 'OEM', hint: 'Post-manoeuvre state ephemeris' },
  { id: 'CCSDS_OCM', label: 'OCM', hint: 'Manoeuvre plan summary' },
]

function download(fileName: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function Checks({ report }: { report: ComplianceReport }) {
  return (
    <ul className="space-y-1.5">
      {report.checks.map((c) => (
        <li key={c.id} className="flex gap-2">
          {c.passed ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-sev-green-ink" />
          ) : (
            <XCircle className="mt-0.5 size-3.5 shrink-0 text-sev-red-ink" />
          )}
          <div>
            <div className="text-[12px] text-primary">{c.label}</div>
            <div className="text-[11px] text-tertiary">{c.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Module M8: preview and export the post-manoeuvre filing for the committed plan. */
export function ComplianceModal() {
  const open = useMissionStore((s) => s.complianceOpen)
  const setComplianceOpen = useMissionStore((s) => s.setComplianceOpen)
  const event = useMissionStore(selectActiveConjunction)
  const sequence = useMissionStore(selectActiveSequence)
  const committedAtMs = useMissionStore((s) => s.committedAtMs)
  const envelope = useMissionStore(
    useShallow((s) => (event ? selectEffectiveEnvelope(s, event.primaryId) : null)),
  )
  const [format, setFormat] = useState<ComplianceFormat>('CCSDS_OEM')

  const report = useMemo(() => {
    const object = event && rsoById.get(event.primaryId)
    if (!open || !event || !sequence || !object || committedAtMs === null) return null
    return buildComplianceReport({ event, sequence, object, envelope, nowMs: committedAtMs, format })
  }, [open, event, sequence, envelope, committedAtMs, format])

  if (!open || !report || !event || !sequence) return null
  const object = rsoById.get(event.primaryId)!
  const secondary = rsoById.get(event.secondaryId)!
  const lines = report.body.split('\n')
  const close = () => setComplianceOpen(false)

  return (
    <Modal
      title="IN-SPACe NGP post-manoeuvre filing · M8"
      onClose={close}
      className="max-w-5xl"
      footer={
        <>
          <Button onClick={close}>Close</Button>
          <Button onClick={() => download(`${report.id}.json`, JSON.stringify(report, null, 2), 'application/json')}>
            <FileJson className="size-3.5" /> Report (.json)
          </Button>
          <Button variant="primary" onClick={() => download(complianceFileName(report), report.body, 'text/plain')}>
            <Download className="size-3.5" /> {complianceFileName(report).split('.').pop()?.toUpperCase()} file
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-2 border-b border-sev-yellow/20 bg-sev-yellow/[0.08] px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-sev-yellow-ink">
        <ShieldAlert className="size-3.5" /> Demo output · not an official IN-SPACe document or authorization
      </div>
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-5 border-r border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-medium uppercase tracking-widest text-tertiary">Filing</div>
              <div className="font-mono text-sm font-medium text-primary">{report.id}</div>
            </div>
            <span
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-widest',
                report.status === 'READY' ? 'bg-sev-green/10 text-sev-green-ink' : 'bg-sev-orange/10 text-sev-orange-ink',
              )}
            >
              {report.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Operator" value={report.operator} mono={false} />
            <Field label="Authorization ref" value={report.authorizationRef} />
            <Field label="Asset" value={`${object.name} · ${object.noradId}`} mono={false} />
            <Field label="Conjunction" value={`${event.id} · ${secondary.name}`} mono={false} />
            <Field label="Plan" value={sequence.name} mono={false} />
            <Field label="Committed" value={`${formatUtc(Date.parse(report.generatedAt), false)} UTC`} />
          </div>
          <div>
            <div className="mb-2 text-[9px] font-medium uppercase tracking-widest text-tertiary">Pre-submission checks</div>
            <Checks report={report} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-4">
          <div className="mb-2 flex items-center gap-1" role="tablist" aria-label="Export format">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={format === f.id}
                title={f.hint}
                onClick={() => setFormat(f.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors duration-100 ease-out',
                  format === f.id ? 'bg-accent-muted text-accent' : 'text-secondary hover:bg-elevated hover:text-primary',
                )}
              >
                CCSDS {f.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-tertiary">
              <span className="font-mono tabular-nums">{lines.length.toLocaleString()}</span> lines
            </span>
          </div>
          <pre className="max-h-[52vh] min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-base p-3 font-mono text-[10.5px] leading-relaxed text-secondary">
            {lines.slice(0, PREVIEW_LINES).join('\n')}
            {lines.length > PREVIEW_LINES && (
              <span className="text-tertiary">{`\n… ${(lines.length - PREVIEW_LINES).toLocaleString()} more lines in the download`}</span>
            )}
          </pre>
        </div>
      </div>
    </Modal>
  )
}
