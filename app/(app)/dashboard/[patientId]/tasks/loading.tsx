import { Skeleton } from '@/components/ui/skeleton'

export default function TasksLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      {/* Task rows */}
      <div className="border rounded-xl overflow-hidden divide-y divide-border">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
