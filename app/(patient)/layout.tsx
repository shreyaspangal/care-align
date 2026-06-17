import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { getProfile } from '@/lib/dal/profiles'
import { Logo } from '@/components/ui/logo'

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/login')

  // Coordinators must never reach the patient shell — redirect them to their own dashboard.
  if (profile.role === 'coordinator') redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <span className="text-2xs font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full bg-brand-tint text-brand-base">
            Your care
          </span>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors" style={{ transitionDuration: 'var(--duration-base)', transitionTimingFunction: 'var(--ease-hover)' }}>
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
