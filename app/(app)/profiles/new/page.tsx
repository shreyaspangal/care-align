import type { Metadata } from 'next'
import { addProfile } from '@/actions/profiles'
import { ProfileForm } from '@/components/features/ProfileForm'

export const metadata: Metadata = { title: 'Add family member — CareAlign' }

export default function NewProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Add a family member</h1>
      <ProfileForm action={addProfile} submitLabel="Add profile" />
    </main>
  )
}
