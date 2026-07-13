import { Skeleton } from '@/components/ui/skeleton'

export default function AccessLoading() {
  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="border rounded-xl overflow-hidden divide-y divide-border">
        {[1, 2].map(i => (
          <div key={i} className="flex items-center justify-between px-4 py-3.5">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
