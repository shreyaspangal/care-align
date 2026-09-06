import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/dal/profiles'
import { getDocuments } from '@/lib/dal/documents'
import { createDocument, retryOrganize, updateDocumentDetails } from '@/actions/documents'
import { CaptureButton } from '@/components/features/CaptureButton'
import { DocumentCard } from '@/components/features/DocumentCard'

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

  const documents = await getDocuments(profileId)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{profile.name}</h1>
        <Link href="/profiles" className="text-sm text-muted-foreground hover:text-foreground">
          Switch profile
        </Link>
      </header>
      <CaptureButton profileId={profile.id} createDocument={createDocument} />
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents yet — capture the first one above.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              retryOrganize={retryOrganize}
              updateDocumentDetails={updateDocumentDetails}
            />
          ))}
        </div>
      )}
    </main>
  )
}
