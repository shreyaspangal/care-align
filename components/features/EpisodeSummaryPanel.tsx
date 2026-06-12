import { EpisodeStatusCard } from '@/components/composites/EpisodeStatusCard'
import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
import { Separator } from '@/components/ui/separator'

type EpisodeStatus = 'active' | 'care_complete' | 'closed'

type TaskCategory =
  | 'insurance'
  | 'medication'
  | 'doctor_visit'
  | 'lifestyle'
  | 'test_results'
  | 'forms'
  | 'payment'

type TaskCount = { category: TaskCategory; count: number }

type EpisodeSummaryPanelProps = {
  episodeStatus: EpisodeStatus
  summary: {
    visit_purpose: string
    timeline_summary: string
    status_label: string
    status_description: string
    version: number
    updated_at: string
  } | null
  openTaskCounts: TaskCount[]
}

export function EpisodeSummaryPanel({
  episodeStatus,
  summary,
  openTaskCounts,
}: EpisodeSummaryPanelProps) {
  if (!summary) {
    return (
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
        <div className="h-3 bg-muted rounded animate-pulse w-full" />
        <div className="h-3 bg-muted rounded animate-pulse w-5/6" />
        <p className="text-xs text-muted-foreground pt-1">
          Summary will appear after the first document is processed.
        </p>
      </div>
    )
  }

  const paragraphs = summary.timeline_summary.split('\n\n').filter(Boolean)

  return (
    <div className="space-y-4">
      <EpisodeStatusCard summary={summary} episodeStatus={episodeStatus} />

      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Why admitted
          </p>
          <p className="text-sm leading-relaxed">{summary.visit_purpose}</p>
        </div>

        {paragraphs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                What has happened
              </p>
              <div className="space-y-2">
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}

        {openTaskCounts.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Open tasks
              </p>
              <ul className="space-y-1.5">
                {openTaskCounts.map(({ category, count }) => (
                  <li key={category} className="flex items-center gap-2 text-sm">
                    <TaskCategoryIcon category={category} size={14} />
                    <span className="capitalize">{category.replace('_', ' ')}</span>
                    <span className="ml-auto text-xs font-medium text-muted-foreground">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
