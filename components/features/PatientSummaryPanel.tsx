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
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Your care status
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-sm">Your care episode is open</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary animate-spin" style={{animationDuration:'3s'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
            <p className="text-sm text-muted-foreground">Your coordinator is reviewing your documents</p>
          </div>
          <div className="flex items-center gap-3 opacity-40">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <p className="text-sm text-muted-foreground">Your summary will appear here once ready</p>
          </div>
        </div>
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
