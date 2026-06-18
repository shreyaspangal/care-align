import { redirect } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { getProfile } from '@/lib/dal/profiles'
import { togglePinPatient } from '@/actions/pin-patient'
import { Logo } from '@/components/ui/logo'
import { CoordinatorSidebarNav } from '@/components/features/CoordinatorSidebarNav'
import { UserProfileMenu } from '@/components/features/UserProfileMenu'
import { getCoordinatorPatients } from '@/lib/dal/patients'

export default async function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'coordinator') redirect('/login')

  const patients = await getCoordinatorPatients(user.id)
  const initial  = profile.name?.[0]?.toUpperCase() ?? '?'

  return (
    <>
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">

      {/* ── Sidebar — desktop only ─────────────────────────────────── */}
      {/* sticky + h-screen keeps the sidebar viewport-height regardless */}
      {/* of how tall the right content column grows                    */}
      <aside className="hidden lg:flex flex-col border-r border-border bg-card sticky top-0 h-screen overflow-hidden">

        {/* Logo — clicking always navigates home to /dashboard */}
        <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
          <Link href="/dashboard" aria-label="All patients">
            <Logo size="sm" />
          </Link>
        </div>

        {/* Patient nav — scrollable */}
        <CoordinatorSidebarNav patients={patients} onTogglePin={togglePinPatient} />

        {/* Profile — anchored to bottom */}
        <div className="border-t border-border p-2 flex-shrink-0">
          <UserProfileMenu
            name={profile.name ?? 'Coordinator'}
            email={user.email ?? ''}
            initial={initial}
            onLogout={logout}
          />
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────── */}
      <div className="flex flex-col min-h-screen lg:min-h-0">

        {/* Mobile header */}
        <header className="lg:hidden border-b-2 border-brand-base bg-card px-4 h-14 flex items-center justify-between flex-shrink-0">
          <Link href="/dashboard"><Logo size="md" /></Link>
          <form action={logout}>
            <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign out
            </button>
          </form>
        </header>

        <main className="flex-1">{children}</main>
      </div>

    </div>

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
