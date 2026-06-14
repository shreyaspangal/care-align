import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveEpisode, getEpisodeSummary, getOpenTaskCounts } from '@/lib/dal/episodes'
import { getEpisodeDocuments } from '@/lib/dal/documents'
import { DocumentUploadZone } from '@/components/features/DocumentUploadZone'
import { EpisodeTimeline } from '@/components/features/EpisodeTimeline'
import { EpisodeSummaryPanel } from '@/components/features/EpisodeSummaryPanel'
import { CreateEpisodeButton } from '@/components/features/CreateEpisodeButton'
import { uploadDocument } from '@/actions/upload-document'
import { ArrowLeft } from 'lucide-react'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function CoordinatorDashboardPage({ params }: Props) {
  const { patientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify coordinator has access to this patient
  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!access || access.role !== 'coordinator') notFound()

  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, admission_status')
    .eq('id', patientId)
    .single()

  if (!patient) notFound()

  const activeEpisode = await getActiveEpisode(patientId)

  const [documents, episodeSummary, openTaskCounts] = activeEpisode
    ? await Promise.all([
        getEpisodeDocuments(activeEpisode.id),
        getEpisodeSummary(activeEpisode.id),
        getOpenTaskCounts(activeEpisode.id),
      ])
    : [[], null, []]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All patients
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{patient.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {patient.admission_status.replace('_', ' ')}
          </p>
        </div>
      </div>

      {activeEpisode ? (
        <div className="space-y-6">
          <EpisodeSummaryPanel
            episodeStatus={activeEpisode.status}
            summary={episodeSummary}
            openTaskCounts={openTaskCounts}
          />

          <DocumentUploadZone episodeId={activeEpisode.id} onUpload={uploadDocument} />

          <EpisodeTimeline documents={documents} viewerRole="coordinator" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">No active episode for this patient.</p>
          <CreateEpisodeButton patientId={patient.id} />
        </div>
      )}
    </div>
  )
}
