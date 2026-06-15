import { Skeleton } from '@/components/ui/skeleton'

export default function PatientViewLoading() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Greeting */}
      <div className="space-y-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Summary panel */}
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <Skeleton className="h-3 w-24" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Document cards */}
      <div className="space-y-3">
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
  )
}
