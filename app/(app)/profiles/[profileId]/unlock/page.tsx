import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { unlockProfile } from '@/actions/profiles'
import { PinForm } from '@/components/features/PinForm'
import { getProfile } from '@/lib/dal/profiles'

export const metadata: Metadata = { title: 'Unlock profile — CareAlign' }

export default async function UnlockProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params
  const profile = await getProfile(profileId)
  if (!profile) notFound()
  if (!profile.hasPin) redirect(`/p/${profile.id}`)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xs flex-col justify-center gap-6 px-4">
      <h1 className="text-center text-xl font-semibold">{profile.name}</h1>
      <PinForm
        action={unlockProfile.bind(null, profile.id)}
        label="Enter this profile's PIN"
        submitLabel="Unlock"
      />
    </main>
  )
}
