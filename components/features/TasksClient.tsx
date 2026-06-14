'use client'

import { useState, useEffect, useTransition } from 'react'
import { LayoutList, LayoutGrid, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PendingTaskRow } from '@/components/composites/PendingTaskRow'
import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
import { Badge } from '@/components/ui/badge'
import type { TaskCategory } from '@/lib/types/domain'
import type { EpisodeTask } from '@/lib/dal/tasks'
import type { ResolveTaskResult } from '@/actions/resolve-task'

type View = 'list' | 'card'
type TaskWithStatus = EpisodeTask & { status: EpisodeTask['status'] }

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  insurance: 'Insurance',
  medication: 'Medication',
  doctor_visit: 'Doctor Visit',
  lifestyle: 'Lifestyle',
  test_results: 'Test Results',
  forms: 'Forms',
  payment: 'Payment',
}

type TasksClientProps = {
  tasks: EpisodeTask[]
  defaultShowPostDischarge?: boolean
  onResolve: (taskId: string) => Promise<ResolveTaskResult>
}

export function TasksClient({ tasks, defaultShowPostDischarge = false, onResolve }: TasksClientProps) {
  const [view, setView] = useState<View>('list')

  // Sync from localStorage after hydration. Lazy initializer would cause an SSR/client
  // mismatch when the saved value differs from the default. This effect runs once on
  // mount (client-only) and is the correct pattern for external store hydration.
  useEffect(() => {
    const saved = localStorage.getItem('tasks-view') as View | null
    if (saved !== 'list' && saved !== 'card') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(saved)
  }, [])
  const [showPostDischarge, setShowPostDischarge] = useState(defaultShowPostDischarge)
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [optimisticResolved, setOptimisticResolved] = useState<Set<string>>(new Set())

  const handleViewToggle = (v: View) => {
    setView(v)
    localStorage.setItem('tasks-view', v)
  }

  const handleConfirmResolve = () => {
    if (!confirmTaskId) return
    const id = confirmTaskId
    setConfirmTaskId(null)
    setOptimisticResolved(prev => new Set(prev).add(id))
    startTransition(async () => {
      const result = await onResolve(id)
      if (!result?.ok) {
        // Roll back optimistic update on failure
        setOptimisticResolved(prev => { const next = new Set(prev); next.delete(id); return next })
      }
    })
  }

  const visibleTasks = tasks.filter(t =>
    showPostDischarge ? true : t.phase_appears === 'during_care'
  )

  const tasksWithStatus = visibleTasks.map(t => ({
    ...t,
    status: optimisticResolved.has(t.id) ? 'resolved' as const : t.status,
  }))

  const openCount = tasksWithStatus.filter(t => t.status === 'open').length
  const hasPostDischarge = tasks.some(t => t.phase_appears === 'post_discharge')
  const allResolved = tasksWithStatus.length > 0 && openCount === 0

  const grouped = tasksWithStatus.reduce<Partial<Record<TaskCategory, TaskWithStatus[]>>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category]!.push(t)
    return acc
  }, {})

  const categoryOrder: TaskCategory[] = [
    'medication', 'doctor_visit', 'test_results', 'insurance', 'payment', 'forms', 'lifestyle',
  ]
  const sortedCategories = categoryOrder.filter(c => grouped[c]?.length)

  return (
    <>
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {openCount} open {openCount === 1 ? 'task' : 'tasks'}
          {allResolved && tasksWithStatus.length > 0 ? ' — all done' : ''}
        </p>
        <div className="flex items-center gap-2">
          {hasPostDischarge && (
            <Button
              variant={showPostDischarge ? 'secondary' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setShowPostDischarge(p => !p)}
            >
              {showPostDischarge ? 'Hide post-discharge' : 'Show post-discharge'}
            </Button>
          )}
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewToggle('list')}
              className={`rounded-none px-2.5 py-1.5 h-auto ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
              aria-label="List view"
            >
              <LayoutList size={15} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewToggle('card')}
              className={`rounded-none px-2.5 py-1.5 h-auto ${view === 'card' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
              aria-label="Card view"
            >
              <LayoutGrid size={15} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Empty / all-resolved states ───────────────────────────────────── */}
      {tasksWithStatus.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">No tasks yet. They will appear after documents are uploaded.</p>
        </div>
      )}

      {allResolved && tasksWithStatus.length > 0 && (
        <div className="rounded-xl border bg-card p-8 flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="text-green-500" size={28} />
          <p className="text-sm font-medium">All tasks complete</p>
          <p className="text-xs text-muted-foreground">Resolved tasks are shown below</p>
        </div>
      )}

      {/* ── List view ─────────────────────────────────────────────────────── */}
      {view === 'list' && tasksWithStatus.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          {tasksWithStatus.map(task => (
            <div
              key={task.id}
              className={task.status === 'resolved' ? 'opacity-50' : undefined}
            >
              <PendingTaskRow
                task={task}
                onResolve={task.status === 'open' ? () => setConfirmTaskId(task.id) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Card view (grouped by category) ──────────────────────────────── */}
      {view === 'card' && tasksWithStatus.length > 0 && (
        <div className="space-y-6">
          {sortedCategories.map(category => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <TaskCategoryIcon category={category} size={15} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {CATEGORY_LABELS[category]}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {grouped[category]!.map(task => (
                  <div
                    key={task.id}
                    className={`border rounded-lg p-3.5 bg-card space-y-2.5 ${task.status === 'resolved' ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="text-xs shrink-0 capitalize">
                        {task.phase_appears === 'post_discharge' ? 'Post-discharge' : 'During care'}
                      </Badge>
                    </div>
                    <p className={`text-sm leading-snug ${task.status === 'resolved' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.description}
                    </p>
                    {task.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setConfirmTaskId(task.id)}
                        disabled={isPending}
                      >
                        Mark as done
                      </Button>
                    )}
                    {task.status === 'resolved' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-green-500" /> Done
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Inline confirm banner ─────────────────────────────────────────── */}
      {confirmTaskId !== null && (
        <div className="border rounded-xl bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm">Mark this task as done? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmTaskId(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmResolve}
              disabled={isPending}
            >
              Mark as done
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
