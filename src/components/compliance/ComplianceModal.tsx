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
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-sev-green" />
          ) : (
            <XCircle className="mt-0.5 size-3.5 shrink-0 text-sev-red" />
          )}
          <div>
            <div className="text-[12px] text-ink">{c.label}</div>
            <div className="font-mono text-[10px] text-ink-faint">{c.detail}</div>
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
      <div className="flex items-center gap-2 border-b border-sev-yellow/30 bg-sev-yellow/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-sev-yellow">
        <ShieldAlert className="size-3.5" /> Demo output · not an official IN-SPACe document or authorization
      </div>
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4 border-r border-line p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">Filing</div>
              <div className="font-mono text-sm text-ink">{report.id}</div>
            </div>
            <span
              className={cn(
                'rounded px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest',
                report.status === 'READY' ? 'bg-sev-green/15 text-sev-green' : 'bg-sev-orange/15 text-sev-orange',
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
            <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-ink-faint">Pre-submission checks</div>
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
                  'rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider',
                  format === f.id ? 'bg-protected/15 text-protected' : 'text-ink-muted hover:text-ink',
                )}
              >
                CCSDS {f.label}
              </button>
            ))}
            <span className="ml-auto font-mono text-[10px] text-ink-faint">{lines.length.toLocaleString()} lines</span>
          </div>
          <pre className="max-h-[52vh] min-h-0 flex-1 overflow-auto rounded border border-line bg-void p-3 font-mono text-[10.5px] leading-relaxed text-ink-muted">
            {lines.slice(0, PREVIEW_LINES).join('\n')}
            {lines.length > PREVIEW_LINES && (
              <span className="text-ink-faint">{`\n… ${(lines.length - PREVIEW_LINES).toLocaleString()} more lines in the download`}</span>
            )}
          </pre>
        </div>
      </div>
    </Modal>
  )
}
