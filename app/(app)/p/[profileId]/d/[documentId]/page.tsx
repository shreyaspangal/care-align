import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDocumentDetail } from '@/lib/dal/documents'
import { deleteDocument } from '@/actions/documents'
import { DocumentDetail } from '@/components/features/DocumentDetail'

export const metadata: Metadata = { title: 'Document — CareAlign' }

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ profileId: string; documentId: string }>
}) {
  const { profileId, documentId } = await params
  const document = await getDocumentDetail(documentId)
  // RLS already scopes this to the caller's family; this also catches a
  // documentId that belongs to a different profile in the same family, so
  // the URL's profileId always matches what's actually rendered.
  if (!document || document.profileId !== profileId) notFound()

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Link
        href={`/p/${profileId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to timeline
      </Link>
      <DocumentDetail document={document} deleteDocument={deleteDocument} />
    </main>
  )
}
