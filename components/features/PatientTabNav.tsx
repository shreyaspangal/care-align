'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CheckSquare } from 'lucide-react'

type PatientTabNavProps = {
  patientId: string
}

export function PatientTabNav({ patientId }: PatientTabNavProps) {
  const pathname = usePathname()
  const isTasksActive = (pathname ?? '').endsWith('/tasks')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-bottom">
      <div className="max-w-3xl mx-auto flex">
        <Link
          href={`/dashboard/${patientId}`}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors min-h-[52px] justify-center ${
            !isTasksActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutDashboard size={20} strokeWidth={!isTasksActive ? 2.5 : 1.75} />
          <span className={!isTasksActive ? 'font-medium' : ''}>Overview</span>
        </Link>
        <Link
          href={`/dashboard/${patientId}/tasks`}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors min-h-[52px] justify-center ${
            isTasksActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckSquare size={20} strokeWidth={isTasksActive ? 2.5 : 1.75} />
          <span className={isTasksActive ? 'font-medium' : ''}>Tasks</span>
        </Link>
      </div>
    </nav>
  )
}
