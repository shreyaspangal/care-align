import { getActiveEpisode, getEpisodeSummary } from '@/lib/dal/episodes'
import { getPatientActions } from '@/lib/dal/documents'
import { PatientSummaryPanel } from '@/components/features/PatientSummaryPanel'
import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function PatientSummaryPage({ params }: Props) {
  const { patientId } = await params

  const activeEpisode = await getActiveEpisode(patientId)

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
