import { redirect } from 'next/navigation'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { Logo } from '@/components/ui/logo'
import { CoordinatorSidebarNav } from '@/components/features/CoordinatorSidebarNav'
import { getCoordinatorPatients } from '@/lib/dal/patients'

export default async function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'coordinator') redirect('/login')

  const patients = await getCoordinatorPatients(user.id)
  const initial = profile.name?.[0]?.toUpperCase() ?? '?'

  return (
    <>
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">

      {/* ── Sidebar — desktop only ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col border-r border-border bg-card">

        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
          <Logo size="sm" />
        </div>

        {/* Patient nav */}
        <CoordinatorSidebarNav patients={patients} />

        {/* User + sign out */}
        <div className="border-t border-border p-3 flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-brand-tint flex items-center justify-center text-brand-base text-xs font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{profile.name}</p>
            <form action={logout}>
              <button
                type="submit"
                className="text-2xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ transitionDuration: 'var(--duration-base)' }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────── */}
      <div className="flex flex-col min-h-screen lg:min-h-0">

        {/* Mobile header — hidden on desktop where sidebar takes over */}
        <header className="lg:hidden border-b-2 border-brand-base bg-card px-4 h-14 flex items-center justify-between flex-shrink-0">
          <Logo size="md" />
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              style={{ transitionDuration: 'var(--duration-base)' }}
            >
              Sign out
            </button>
          </form>
        </header>

        <main className="flex-1">{children}</main>
      </div>

    </div>

    {/* Google Maps Places — loaded once for the coordinator shell; needed by hospital autocomplete */}
    {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
      <Script
        id="google-maps"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
        strategy="afterInteractive"
      />
    )}
    </>
  )
}
