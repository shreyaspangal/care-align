import { notFound } from 'next/navigation'
import { getActiveEpisode, getEpisodeSummary, getOpenTaskCounts } from '@/lib/dal/episodes'
import { getPatientAccess } from '@/lib/dal/patients'
import { getPatientActions } from '@/lib/dal/documents'
import { createEpisode } from '@/actions/create-episode'
import { EpisodeSummaryPanel } from '@/components/features/EpisodeSummaryPanel'
import { PatientSummaryPanel } from '@/components/features/PatientSummaryPanel'
import { CreateEpisodeButton } from '@/components/features/CreateEpisodeButton'
import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
import { updateEpisodeStatus } from '@/actions/update-episode-status'

type Props = {
  params: Promise<{ patientId: string }>
}

// Permission-aware, not two routes: the parent layout already blocks
// rendering entirely when access is missing, so `!access` here is
// defense-in-depth, not the primary gate.
export default async function PatientDetailSummaryPage({ params }: Props) {
  const { patientId } = await params

  const access = await getPatientAccess(patientId)
  if (!access) notFound()

  const activeEpisode = await getActiveEpisode(patientId)

  if (access.role === 'patient') {
    const [episodeSummary, patientActions] = activeEpisode
      ? await Promise.all([
          getEpisodeSummary(activeEpisode.id),
          getPatientActions(activeEpisode.id),
        ])
      : [null, []]

    return (
      <div className="max-w-xl mx-auto px-4 py-5 space-y-6">
        {activeEpisode && (
          <PatientSummaryPanel
            episodeStatus={activeEpisode.status}
            summary={episodeSummary}
          />
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">What you need to do</h2>

          {patientActions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing yet — your coordinator is reviewing your documents.
            </p>
          ) : (
            <div className="space-y-2">
              {patientActions.map(action => (
                <div
                  key={action.id}
                  className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3"
                >
                  <span className="mt-0.5 flex-shrink-0 text-brand-base">
                    <TaskCategoryIcon category={action.category} size={15} />
                  </span>
                  <p className="text-sm text-foreground leading-snug">{action.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

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
          <CreateEpisodeButton patientId={patientId} onCreateEpisode={createEpisode} />
        </div>
      )}
    </div>
  )
}
