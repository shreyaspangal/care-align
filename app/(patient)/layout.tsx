import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { Logo } from '@/components/ui/logo'

export default async function PatientLayout({
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

  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 border-patient-base bg-patient-surface px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <span className="text-2xs font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full bg-patient-tint text-patient-base">
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
