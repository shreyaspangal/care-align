import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
import { Button } from '@/components/ui/button'

type TaskCategory = 'insurance' | 'medication' | 'doctor_visit' | 'lifestyle' | 'test_results' | 'forms' | 'payment'
type TaskStatus = 'open' | 'resolved'
type TaskPhase = 'during_care' | 'post_discharge'

type PendingTaskRowProps = {
  task: {
    id: string
    category: TaskCategory
    description: string
    status: TaskStatus
    phase_appears: TaskPhase
  }
  onResolve?: (id: string) => void
}

export function PendingTaskRow({ task, onResolve }: PendingTaskRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <TaskCategoryIcon category={task.category} size={18} />
      <span className="flex-1 text-sm text-foreground leading-snug">{task.description}</span>
      {onResolve && task.status === 'open' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onResolve(task.id)}
          className="shrink-0 text-xs"
        >
          Resolve
        </Button>
      )}
    </div>
  )
}
