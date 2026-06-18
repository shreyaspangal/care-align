import { getActiveEpisode } from '@/lib/dal/episodes'
import { getEpisodeDocuments } from '@/lib/dal/documents'
import { EpisodeTimeline } from '@/components/features/EpisodeTimeline'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function PatientDocumentsPage({ params }: Props) {
  const { patientId } = await params

  const activeEpisode = await getActiveEpisode(patientId)
  const documents     = activeEpisode ? await getEpisodeDocuments(activeEpisode.id) : []

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
