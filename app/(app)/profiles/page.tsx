import type { Metadata } from 'next'
import { logout } from '@/actions/auth'
import { ProfileGrid } from '@/components/features/ProfileGrid'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { getFamily } from '@/lib/dal/families'
import { getProfiles } from '@/lib/dal/profiles'

export const metadata: Metadata = { title: 'Who is this for? — CareAlign' }

export default async function ProfilesPage() {
  const [family, profiles] = await Promise.all([getFamily(), getProfiles()])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <Logo size="md" />
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Log out
          </Button>
        </form>
      </header>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Who is this for?</h1>
        {family && <p className="text-sm text-muted-foreground">{family.name}</p>}
      </div>
      <ProfileGrid profiles={profiles} />
    </main>
  )
}
