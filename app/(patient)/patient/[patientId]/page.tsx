import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveEpisode, getEpisodeSummary } from '@/lib/dal/episodes'
import { getEpisodeDocuments } from '@/lib/dal/documents'
import { PatientSummaryPanel } from '@/components/features/PatientSummaryPanel'
import { EpisodeTimeline } from '@/components/features/EpisodeTimeline'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function PatientViewPage({ params }: Props) {
  const { patientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify user has patient-role access to this patient record
  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!access || access.role !== 'patient') notFound()

  const { data: patient } = await supabase
    .from('patients')
    .select('id, name')
    .eq('id', patientId)
    .single()

  if (!patient) notFound()

  const activeEpisode = await getActiveEpisode(patientId)

  const [documents, episodeSummary] = activeEpisode
    ? await Promise.all([
        getEpisodeDocuments(activeEpisode.id),
        getEpisodeSummary(activeEpisode.id),
      ])
    : [[], null]

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hello, {patient.name.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here is what is happening with your care.
        </p>
      </div>

      {activeEpisode ? (
        <div className="space-y-6">
          <PatientSummaryPanel
            episodeStatus={activeEpisode.status}
            summary={episodeSummary}
          />

          <EpisodeTimeline documents={documents} viewerRole="patient" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground text-sm">
          No active episode. Contact your coordinator for details.
        </div>
      )}
    </div>
  )
}
