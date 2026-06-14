'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { EpisodeStatusBadge } from '@/components/primitives/EpisodeStatusBadge'
import type { EpisodeStatus } from '@/lib/types/domain'
import type { UpdateEpisodeStatusResult } from '@/actions/update-episode-status'

type Transition = {
  newStatus: 'care_complete' | 'closed'
  buttonLabel: string
  confirmText: string
}

const TRANSITIONS: Partial<Record<EpisodeStatus, Transition>> = {
  active: {
    newStatus: 'care_complete',
    buttonLabel: 'Mark care complete',
    confirmText: 'The patient has been medically cleared and is ready for discharge. Post-discharge tasks will become visible to the coordinator.',
  },
  care_complete: {
    newStatus: 'closed',
    buttonLabel: 'Close episode',
    confirmText: 'All discharge paperwork and payments are settled. This episode will be marked as closed.',
  },
}

type EpisodeStatusManagerProps = {
  episodeId: string
  currentStatus: EpisodeStatus
  onUpdateStatus: (
    episodeId: string,
    newStatus: 'care_complete' | 'closed',
  ) => Promise<UpdateEpisodeStatusResult>
}

export function EpisodeStatusManager({
  episodeId,
  currentStatus,
  onUpdateStatus,
}: EpisodeStatusManagerProps) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const transition = TRANSITIONS[currentStatus]

  const handleConfirm = () => {
    if (!transition) return
    setError(null)
    startTransition(async () => {
      const result = await onUpdateStatus(episodeId, transition.newStatus)
      setConfirming(false)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="border rounded-xl p-5 bg-card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Episode status
        </p>
        <EpisodeStatusBadge status={currentStatus} />
      </div>

      {currentStatus === 'closed' && (
        <p className="text-sm text-muted-foreground">
          This episode is closed. No further changes can be made.
        </p>
      )}

      {transition && !confirming && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setConfirming(true)}
          disabled={isPending}
        >
          {transition.buttonLabel}
        </Button>
      )}

      {transition && confirming && (
        <div className="space-y-3 pt-1">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {transition.confirmText}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setConfirming(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? 'Updating…' : 'Confirm'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
