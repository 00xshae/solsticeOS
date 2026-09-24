import { Info } from 'lucide-react'

/** A small "i" glyph beside a heading; hover or focus reveals the definition. */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        aria-label="More info"
        className="grid size-3.5 place-items-center rounded-full text-tertiary transition-colors duration-100 ease-out hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <Info className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-elevated px-2.5 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-secondary opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
