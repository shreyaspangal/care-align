import { Separator } from '@/components/ui/separator'
import type { EpisodeStatus } from '@/lib/types/domain'

type PatientSummaryPanelProps = {
  episodeStatus: EpisodeStatus
  summary: {
    visit_purpose: string
    timeline_summary: string
  } | null
}

export function PatientSummaryPanel({ episodeStatus, summary }: PatientSummaryPanelProps) {
  if (!summary) {
    return (
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
        <div className="h-3 bg-muted rounded animate-pulse w-full" />
        <div className="h-3 bg-muted rounded animate-pulse w-5/6" />
        <p className="text-xs text-muted-foreground pt-1">
          Your coordinator is reviewing your documents. A summary will appear here shortly.
        </p>
      </div>
    )
  }

  const statusLabel: Record<EpisodeStatus, string> = {
    active: 'You are currently receiving care',
    care_complete: 'Your medical care is complete',
    closed: 'Your episode has been closed',
  }

  const paragraphs = summary.timeline_summary.split('\n\n').filter(Boolean)

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Your status
        </p>
        <p className="text-sm font-medium">{statusLabel[episodeStatus]}</p>
      </div>

      <Separator />

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Why you were admitted
        </p>
        <p className="text-sm leading-relaxed">{summary.visit_purpose}</p>
      </div>

      {paragraphs.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              What has happened so far
            </p>
            {paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
