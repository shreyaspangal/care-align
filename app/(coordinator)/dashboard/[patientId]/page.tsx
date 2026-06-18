import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveEpisode } from '@/lib/dal/episodes'
import { getPatientAccess } from '@/lib/dal/patients'
import { createEpisode } from '@/actions/create-episode'
import { getEpisodeDocuments } from '@/lib/dal/documents'
import { DocumentUploadZone } from '@/components/features/DocumentUploadZone'
import { DocumentsSection } from '@/components/features/DocumentsSection'
import { CreateEpisodeButton } from '@/components/features/CreateEpisodeButton'
import { uploadDocument } from '@/actions/upload-document'
import { deleteDocument } from '@/actions/delete-document'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function CoordinatorDocumentsPage({ params }: Props) {
  const { patientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getPatientAccess(patientId)
  if (!access || access.role !== 'coordinator') notFound()

  const activeEpisode = await getActiveEpisode(patientId)
  const documents = activeEpisode ? await getEpisodeDocuments(activeEpisode.id) : []

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {activeEpisode ? (
        <>
          {/* Upload card */}
          <div className="border rounded-xl bg-card p-5">
            <DocumentUploadZone episodeId={activeEpisode.id} onUpload={uploadDocument} />
          </div>

          {/* Uploaded documents — outside the card */}
          <DocumentsSection
            documents={documents}
            onDelete={deleteDocument}
          />
        </>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">No active episode for this patient.</p>
          <CreateEpisodeButton patientId={patientId} onCreateEpisode={createEpisode} />
        </div>
      )}
    </div>
  )
}
