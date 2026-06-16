import { Skeleton } from '@/components/ui/skeleton'

export default function DocumentsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-20" />
        <div className="space-y-1">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="p-5 space-y-5">
          <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="border-t pt-4 space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
