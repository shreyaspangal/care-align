import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveEpisode, getEpisodeSummary, getOpenTaskCounts } from '@/lib/dal/episodes'
import { EpisodeSummaryPanel } from '@/components/features/EpisodeSummaryPanel'
import { CreateEpisodeButton } from '@/components/features/CreateEpisodeButton'
import { updateEpisodeStatus } from '@/actions/update-episode-status'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function CoordinatorSummaryPage({ params }: Props) {
  const { patientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!access || access.role !== 'coordinator') notFound()

  const activeEpisode = await getActiveEpisode(patientId)

  const [episodeSummary, openTaskCounts] = activeEpisode
    ? await Promise.all([
        getEpisodeSummary(activeEpisode.id),
        getOpenTaskCounts(activeEpisode.id),
      ])
    : [null, []]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {activeEpisode ? (
        <EpisodeSummaryPanel
          episodeId={activeEpisode.id}
          episodeStatus={activeEpisode.status}
          summary={episodeSummary}
          openTaskCounts={openTaskCounts}
          patientId={patientId}
          onUpdateStatus={updateEpisodeStatus}
        />
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">No active episode — upload documents first to generate a summary.</p>
          <CreateEpisodeButton patientId={patientId} />
        </div>
      )}
    </div>
  )
}
