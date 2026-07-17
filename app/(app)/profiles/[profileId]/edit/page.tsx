import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { changeProfilePin, removeProfilePin, setProfilePin, updateProfile } from '@/actions/profiles'
import { PinChangeForm } from '@/components/features/PinChangeForm'
import { PinForm } from '@/components/features/PinForm'
import { ProfileForm } from '@/components/features/ProfileForm'
import { Separator } from '@/components/ui/separator'
import { getProfile } from '@/lib/dal/profiles'

export const metadata: Metadata = { title: 'Edit profile — CareAlign' }

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params
  const profile = await getProfile(profileId)
  if (!profile) notFound()

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Edit {profile.name}</h1>
      <ProfileForm
        action={updateProfile.bind(null, profile.id)}
        submitLabel="Save changes"
        defaults={{
          name: profile.name,
          dob: profile.dob ?? undefined,
          sex: profile.sex ?? undefined,
          color: profile.color,
        }}
      />
      <Separator />
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold">Profile PIN</h2>
          <p className="text-sm text-muted-foreground">
            {profile.hasPin
              ? 'This profile is PIN-protected. Changing or removing the PIN needs the current PIN — or the account password, if it was forgotten.'
              : 'Add a 4-digit PIN so only this member opens their profile. It keeps things private within the family — it is not a password.'}
          </p>
        </div>
        {profile.hasPin ? (
          <>
            <PinChangeForm
              action={changeProfilePin.bind(null, profile.id)}
              mode="change"
              submitLabel="Save new PIN"
            />
            <Separator />
            <PinChangeForm
              action={removeProfilePin.bind(null, profile.id)}
              mode="remove"
              submitLabel="Remove PIN"
            />
          </>
        ) : (
          <PinForm
            action={setProfilePin.bind(null, profile.id)}
            label="Choose a 4-digit PIN"
            submitLabel="Set PIN"
          />
        )}
      </section>
    </main>
  )
}
