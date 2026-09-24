import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** In-app dialog. Escape or a backdrop click closes it; focus moves into it on open. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  className,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Callers pass inline closures; keep the latest without re-running the mount effect.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-void/80 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl outline-none',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-faint hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-protected text-void hover:bg-protected/85',
        variant === 'secondary' && 'border border-line text-ink-muted hover:border-ink-faint hover:text-ink',
        variant === 'danger' && 'bg-sev-orange text-void hover:bg-sev-orange/85',
      )}
    >
      {children}
    </button>
  )
}
