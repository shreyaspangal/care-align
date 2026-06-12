import { EpisodeStatusBadge } from '@/components/primitives/EpisodeStatusBadge'
import type { EpisodeStatus } from '@/lib/types/domain'

type EpisodeStatusCardProps = {
  summary: {
    status_label: string
    status_description: string
    version: number
    updated_at: string
  }
  episodeStatus: EpisodeStatus
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function EpisodeStatusCard({ summary, episodeStatus }: EpisodeStatusCardProps) {
  return (
    <div className="border rounded-xl p-5 bg-card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <EpisodeStatusBadge status={episodeStatus} />
        <span className="text-xs text-muted-foreground">
          Updated {formatRelativeTime(summary.updated_at)}
        </span>
      </div>

      <p className="text-lg font-semibold text-foreground leading-snug">
        {summary.status_label}
      </p>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {summary.status_description}
      </p>
    </div>
  )
}
