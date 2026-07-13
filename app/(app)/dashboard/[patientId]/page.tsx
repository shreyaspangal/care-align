import { notFound } from 'next/navigation'
import { getActiveEpisode } from '@/lib/dal/episodes'
import { getPatientAccess } from '@/lib/dal/patients'
import { createEpisode } from '@/actions/create-episode'
import { getEpisodeDocuments } from '@/lib/dal/documents'
import { DocumentUploadZone } from '@/components/features/DocumentUploadZone'
import { DocumentsSection } from '@/components/features/DocumentsSection'
import { CreateEpisodeButton } from '@/components/features/CreateEpisodeButton'
import { EpisodeTimeline } from '@/components/features/EpisodeTimeline'
import { uploadDocument } from '@/actions/upload-document'
import { deleteDocument } from '@/actions/delete-document'

type Props = {
  params: Promise<{ patientId: string }>
}

// Permission-aware, not two routes: the parent layout already blocks
// rendering entirely when access is missing, so `!access` here is
// defense-in-depth, not the primary gate.
export default async function PatientDetailDocumentsPage({ params }: Props) {
  const { patientId } = await params

  const access = await getPatientAccess(patientId)
  if (!access) notFound()

  const activeEpisode = await getActiveEpisode(patientId)
  const documents = activeEpisode ? await getEpisodeDocuments(activeEpisode.id) : []

  if (access.role === 'patient') {
    return (
      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Uploaded documents</h2>
          {documents.length > 0 && (
            <span className="text-xs text-muted-foreground">{documents.length}</span>
          )}
        </div>

        <EpisodeTimeline documents={documents} viewerRole="patient" />
      </div>
    )
  }

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
