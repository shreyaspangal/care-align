import { cn } from '@/lib/utils'

type EpisodeStatus = 'active' | 'care_complete' | 'closed'

type EpisodeStatusBadgeProps = {
  status: EpisodeStatus
}

const dotStyles: Record<EpisodeStatus, string> = {
  active: 'bg-green-500',
  care_complete: 'bg-amber-500',
  closed: 'bg-gray-400',
}

const containerStyles: Record<EpisodeStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  care_complete: 'bg-amber-50 text-amber-700 border-amber-200',
  closed: 'bg-gray-50 text-gray-600 border-gray-200',
}

const labels: Record<EpisodeStatus, string> = {
  active: 'Active',
  care_complete: 'Care Complete',
  closed: 'Closed',
}

export function EpisodeStatusBadge({ status }: EpisodeStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-sm font-medium',
        containerStyles[status]
      )}
    >
      <span className={cn('w-2 h-2 rounded-full', dotStyles[status])} />
      {labels[status]}
    </span>
  )
}
