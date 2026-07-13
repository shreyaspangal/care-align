'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Sparkles, CheckSquare, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types/domain'

type PatientTabNavProps = {
  patientId: string
  role: UserRole
}

// Tabs are permission-aware, not role-separate routes: Documents + Summary
// always show; Tasks only for a coordinator on this record; Access (the
// patient-visible "who has access" list) only for the patient on this record.
const tabs = (patientId: string, role: UserRole) => [
  {
    label: 'Summary',
    href: `/dashboard/${patientId}/summary`,
    icon: Sparkles,
    isActive: (p: string) => p.includes('/summary'),
  },
  {
    label: 'Documents',
    href: `/dashboard/${patientId}`,
    icon: FileText,
    isActive: (p: string) => !p.includes('/summary') && !p.endsWith('/tasks') && !p.endsWith('/access'),
  },
  ...(role === 'coordinator' ? [{
    label: 'Tasks',
    href: `/dashboard/${patientId}/tasks`,
    icon: CheckSquare,
    isActive: (p: string) => p.endsWith('/tasks'),
  }] : []),
  ...(role === 'patient' ? [{
    label: 'Access',
    href: `/dashboard/${patientId}/access`,
    icon: ShieldCheck,
    isActive: (p: string) => p.endsWith('/access'),
  }] : []),
]

export function PatientTabNav({ patientId, role }: PatientTabNavProps) {
  const pathname = usePathname() ?? ''

  return (
    <nav className="border-b border-border">
      <div className="flex px-4 max-w-3xl mx-auto">
        {tabs(patientId, role).map(({ label, href, icon: Icon, isActive }) => {
          const active = isActive(pathname)
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'inline-flex items-center gap-1.5 py-3 px-1 mr-5 text-sm border-b-2 transition-colors',
                active
                  ? 'border-brand-base text-brand-base font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              style={{ transitionDuration: 'var(--duration-base)', transitionTimingFunction: 'var(--ease-hover)' }}
            >
              <Icon size={14} strokeWidth={active ? 2.5 : 1.75} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
