import { Logo } from '@/components/ui/logo'

const TRUST_POINTS = [
  'Upload any medical document — translated into plain language instantly.',
  'Every episode, every hospital, one connected picture.',
  'Your patient sees their own care story in their own words.',
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1fr_1fr]">

      {/* ── Left panel — brand / value prop ────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between bg-foreground px-12 py-10 relative overflow-hidden">

        {/* Decorative background arc — subtle depth layer */}
        <svg
          aria-hidden="true"
          viewBox="0 0 64 64"
          fill="none"
          className="absolute right-[-120px] top-1/2 -translate-y-1/2 w-[480px] h-[480px] pointer-events-none"
          style={{ opacity: 0.06 }}
        >
          <path
            d="M48 32C48 40.837 40.837 48 32 48C23.163 48 16 40.837 16 32C16 23.163 23.163 16 32 16"
            stroke="var(--brand-base)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M32 16L37 11" stroke="var(--brand-base)" strokeWidth="2" strokeLinecap="round" />
          <path d="M32 16L37 21" stroke="var(--brand-base)" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* Logo */}
        <Logo size="md" variant="light" />

        {/* Centre content */}
        <div className="space-y-8 relative z-10">

          {/* Clay icon */}
          <div className="clay-teal squircle w-14 h-14 flex items-center justify-center animate-float">
            <svg width="30" height="30" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path
                d="M48 32C48 40.837 40.837 48 32 48C23.163 48 16 40.837 16 32C16 23.163 23.163 16 32 16"
                stroke="white"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <path d="M32 16L37 11" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M32 16L37 21" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Tagline */}
          <p className="font-heading font-bold text-background leading-snug" style={{ fontSize: '1.5rem', letterSpacing: '-0.025em' }}>
            From a folder of papers to a connected picture of your care.
          </p>

          {/* Trust points */}
          <ul className="space-y-3">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-base flex-shrink-0" />
                <span className="text-sm leading-relaxed text-background opacity-60">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="text-2xs font-semibold tracking-widest uppercase relative z-10 text-background opacity-30">
          Built for hospital coordinators
        </p>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────────── */}
      <div className="flex flex-col min-h-screen lg:min-h-0">

        {/* Mobile-only logo */}
        <div className="lg:hidden flex items-center px-6 h-14 border-b border-border">
          <Logo size="md" />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          {children}
        </div>
      </div>

    </div>
  )
}
