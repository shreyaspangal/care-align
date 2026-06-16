import { Skeleton } from '@/components/ui/skeleton'

export default function SummaryLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="border-t pt-4 space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="border-t pt-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  )
}
