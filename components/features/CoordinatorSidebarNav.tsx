'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PatientListItem } from '@/lib/dal/patients'

type CoordinatorSidebarNavProps = {
  patients: PatientListItem[]
}

export function CoordinatorSidebarNav({ patients }: CoordinatorSidebarNavProps) {
  const pathname = usePathname() ?? ''

  // Extract patientId from /dashboard/[patientId]/... paths
  const activePatientId = pathname.match(/\/dashboard\/([^/]+)/)?.[1]

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-2">
        Patients
      </p>

      {patients.map(patient => {
        const isActive = activePatientId === patient.id
        return (
          <Link
            key={patient.id}
            href={`/dashboard/${patient.id}`}
            className={cn(
              'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
              isActive
                ? 'bg-brand-tint text-brand-base font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
              patient.admission_status === 'admitted' ? 'bg-success-base' : 'bg-border'
            )} />
            <span className="truncate">{patient.name}</span>
          </Link>
        )
      })}

      {patients.length === 0 && (
        <p className="text-xs text-muted-foreground px-2 py-1">No patients yet.</p>
      )}

      <div className="pt-1">
        <Link
          href="/dashboard/new"
          className={cn(
            'flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors',
            pathname === '/dashboard/new'
              ? 'bg-brand-tint text-brand-base font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <UserPlus size={14} className="flex-shrink-0" />
          <span>Add patient</span>
        </Link>
      </div>
    </nav>
  )
}
