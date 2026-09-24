import { SignInButton } from '@clerk/react'

export function LoginPage() {
  return (
    <div className="grid h-full place-items-center bg-base">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="glow size-2 rounded-full bg-accent [--glow:var(--color-accent)]" aria-hidden />
            <div className="font-display text-3xl leading-none tracking-wide text-primary [font-variant-caps:small-caps]">
              orbital rakshak
            </div>
          </div>
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-tertiary">
            IN-SPACe STM Platform
          </div>
        </div>

        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-lg border border-border-strong bg-elevated px-6 py-2.5 font-display text-xs font-semibold uppercase tracking-widest text-primary transition-colors duration-100 ease-out hover:border-accent/40 hover:bg-overlay hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            Log in
          </button>
        </SignInButton>
      </div>
    </div>
  )
}
