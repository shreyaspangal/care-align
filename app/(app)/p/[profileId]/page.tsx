import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/dal/profiles'

export const metadata: Metadata = { title: 'Timeline — CareAlign' }

export default async function ProfileTimelinePage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params
  // The layout runs the PIN gate, but every segment defends itself — this
  // re-fetch is a React cache() hit within the request, so it costs nothing.
  const profile = await getProfile(profileId)
  if (!profile) notFound()

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{profile.name}</h1>
        <Link href="/profiles" className="text-sm text-muted-foreground hover:text-foreground">
          Switch profile
        </Link>
      </header>
      <p className="text-sm text-muted-foreground">
        Timeline arrives in Phase 3 — capture comes first (Phase 2).
      </p>
    </main>
  )
}
