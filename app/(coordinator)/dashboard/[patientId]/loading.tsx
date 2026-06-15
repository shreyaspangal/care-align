import { Skeleton } from '@/components/ui/skeleton'

export default function PatientDashboardLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Patient header */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-1">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Episode summary panel */}
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

      {/* Documents panel */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="p-5 space-y-4">
          {/* Upload zone placeholder */}
          <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>

          {/* Document card skeletons */}
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
