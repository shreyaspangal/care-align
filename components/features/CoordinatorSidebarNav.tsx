'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserPlus, Pin, LayoutList, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MyAccessListItem } from '@/lib/dal/patients'

type CoordinatorSidebarNavProps = {
  patients: MyAccessListItem[]
  onTogglePin: (patientId: string, currentlyPinned: boolean) => Promise<{ ok: boolean; error?: string }>
}

export function CoordinatorSidebarNav({ patients, onTogglePin }: CoordinatorSidebarNavProps) {
  const pathname = usePathname() ?? ''
  const [showArchived, setShowArchived] = useState(false)
  const [, startTransition] = useTransition()

  const activePatientId = pathname.match(/\/dashboard\/([^/]+)/)?.[1]

  const { active, archived } = useMemo(() => {
    const active: MyAccessListItem[] = []
    const archived: MyAccessListItem[] = []
    for (const p of patients) {
      if (p.admission_status === 'closed') archived.push(p)
      else active.push(p)
    }
    return { active, archived }
  }, [patients])

  function handlePin(e: React.MouseEvent, patient: MyAccessListItem) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      await onTogglePin(patient.id, !!patient.pinned_at)
    })
  }

  return (
    <nav className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-0.5">

        {/* All patients link */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-2 p-2 rounded-lg text-xs transition-colors',
            pathname === '/dashboard'
              ? 'bg-brand-tint text-brand-base font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <LayoutList size={13} className="flex-shrink-0" />
          All patients
        </Link>

        <div className="mt-4">
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground px-2">
            Active
          </p>
        </div>

        {active.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-1">No active patients.</p>
        )}

        {active.map(patient => (
          <PatientRow
            key={patient.id}
            patient={patient}
            isActive={activePatientId === patient.id}
            onPin={handlePin}
          />
        ))}

        {/* Add patient */}
        <div className="pt-1">
          <Link
            href="/dashboard/new"
            className={cn(
              'flex items-center gap-2 p-2 rounded-lg text-xs transition-colors',
              pathname === '/dashboard/new'
                ? 'bg-brand-tint text-brand-base font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <UserPlus size={13} className="flex-shrink-0" />
            Add patient
          </Link>
        </div>

        {/* Archived toggle */}
        {archived.length > 0 && (
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived(v => !v)}
              className="w-full justify-start gap-2 px-2 py-1.5 text-xs text-muted-foreground h-auto"
            >
              <Archive size={13} className="flex-shrink-0" />
              {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
            </Button>

            {showArchived && archived.map(patient => (
              <PatientRow
                key={patient.id}
                patient={patient}
                isActive={activePatientId === patient.id}
                onPin={handlePin}
                dimmed
              />
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

// ── Patient row ───────────────────────────────────────────────────────────────

type PatientRowProps = {
  patient: MyAccessListItem
  isActive: boolean
  onPin: (e: React.MouseEvent, patient: MyAccessListItem) => void
  dimmed?: boolean
}

function PatientRow({ patient, isActive, onPin, dimmed }: PatientRowProps) {
  const [optimisticPinned, setOptimisticPinned] = useState<boolean | null>(null)
  const isPinned = optimisticPinned ?? !!patient.pinned_at

  function handlePin(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOptimisticPinned(!isPinned)
    onPin(e, patient)
  }

  return (
    <Link
      href={`/dashboard/${patient.id}/summary`}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
        isActive
          ? 'bg-brand-tint text-brand-base font-medium'
          : dimmed
            ? 'text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <span className={cn(
        'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
        patient.admission_status === 'admitted' ? 'bg-success-base' : 'bg-border'
      )} />

      <span className="flex-1 truncate">{patient.name}</span>

      {patient.role === 'patient' && (
        <span className="text-2xs text-muted-foreground/70 flex-shrink-0">Your care</span>
      )}

      {/* Always rendered — opacity toggled to avoid height shift */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePin}
        className={cn(
          'h-5 w-5 p-0 flex-shrink-0 transition-opacity',
          isPinned
            ? 'opacity-100 text-brand-base'
            : 'opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-muted-foreground'
        )}
        title={isPinned ? 'Unpin' : 'Pin to top'}
      >
        <Pin size={11} className={isPinned ? 'fill-current' : ''} />
      </Button>
    </Link>
  )
}
