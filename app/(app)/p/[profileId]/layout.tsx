import { notFound, redirect } from 'next/navigation'
import { isProfileUnlocked } from '@/lib/auth/profile-lock'
import { getProfile } from '@/lib/dal/profiles'

// The PIN gate lives HERE, not in child pages — a layout that renders anything
// must do its own access check (CLAUDE.md Hard Rule 8). Every route under
// /p/[profileId] inherits it.
export default async function ProfileLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ profileId: string }>
}>) {
  const { profileId } = await params
  const profile = await getProfile(profileId)
  if (!profile) notFound()

  if (profile.hasPin && !(await isProfileUnlocked(profile.id))) {
    redirect(`/profiles/${profile.id}/unlock`)
  }

  return <>{children}</>
}
