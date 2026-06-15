'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { EpisodeStatusBadge } from '@/components/primitives/EpisodeStatusBadge'
import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
import type { EpisodeStatus, TaskCategory } from '@/lib/types/domain'
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
    confirmText: 'The patient has been medically cleared and is ready for discharge. Post-discharge tasks will become visible.',
  },
  care_complete: {
    newStatus: 'closed',
    buttonLabel: 'Close episode',
    confirmText: 'All discharge paperwork and payments are settled. This episode will be marked as closed.',
  },
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

type TaskCount = { category: TaskCategory; count: number }

type EpisodeSummaryPanelProps = {
  episodeId: string
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
  patientId: string
  onUpdateStatus: (
    episodeId: string,
    newStatus: 'care_complete' | 'closed',
  ) => Promise<UpdateEpisodeStatusResult>
}

export function EpisodeSummaryPanel({
  episodeId,
  episodeStatus,
  summary,
  openTaskCounts,
  patientId,
  onUpdateStatus,
}: EpisodeSummaryPanelProps) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const transition = TRANSITIONS[episodeStatus]

  const handleConfirm = () => {
    if (!transition) return
    setError(null)
    startTransition(async () => {
      const result = await onUpdateStatus(episodeId, transition.newStatus)
      setConfirming(false)
      if (result.ok) {
        toast.success('Episode status updated')
      } else {
        toast.error(result.error)
        setError(result.error)
      }
    })
  }

  const paragraphs = summary?.timeline_summary.split('\n\n').filter(Boolean) ?? []

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Episode Summary</p>
        <div className="flex items-center gap-2 shrink-0">
          {summary && (
            <span className="text-xs text-muted-foreground">
              Updated {formatRelativeTime(summary.updated_at)}
            </span>
          )}
          <EpisodeStatusBadge status={episodeStatus} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5 space-y-5">
        {!summary ? (
          <p className="text-sm text-muted-foreground">
            No summary yet — it will generate after the first document is processed.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-lg font-semibold leading-snug">{summary.status_label}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {summary.status_description}
              </p>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Why admitted
              </p>
              <p className="text-sm leading-relaxed">{summary.visit_purpose}</p>
            </div>

            {paragraphs.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    What has happened
                  </p>
                  {paragraphs.map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed">{p}</p>
                  ))}
                </div>
              </>
            )}

            {openTaskCounts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Open tasks
                    </p>
                    <Link
                      href={`/dashboard/${patientId}/tasks`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                    >
                      View all
                    </Link>
                  </div>
                  <ul className="space-y-1.5">
                    {openTaskCounts.map(({ category, count }) => (
                      <li key={category} className="flex items-center gap-2 text-sm">
                        <TaskCategoryIcon category={category} size={14} />
                        <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                        <span className="ml-auto text-xs font-medium text-muted-foreground">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Episode status action ── */}
        {(transition ?? episodeStatus === 'closed') && (
          <>
            <Separator />
            {episodeStatus === 'closed' ? (
              <p className="text-sm text-muted-foreground">
                This episode is closed. No further changes can be made.
              </p>
            ) : !confirming ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setConfirming(true)}
                disabled={isPending}
              >
                {transition!.buttonLabel}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {transition!.confirmText}
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
            {error && <p className="text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
