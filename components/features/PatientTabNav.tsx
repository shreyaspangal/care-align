'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Sparkles, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type PatientTabNavProps = {
  patientId: string
}

const tabs = (patientId: string) => [
  {
    label: 'Documents',
    href: `/dashboard/${patientId}`,
    icon: FileText,
    isActive: (p: string) => !p.includes('/summary') && !p.endsWith('/tasks'),
  },
  {
    label: 'Summary',
    href: `/dashboard/${patientId}/summary`,
    icon: Sparkles,
    isActive: (p: string) => p.includes('/summary'),
  },
  {
    label: 'Tasks',
    href: `/dashboard/${patientId}/tasks`,
    icon: CheckSquare,
    isActive: (p: string) => p.endsWith('/tasks'),
  },
]

export function PatientTabNav({ patientId }: PatientTabNavProps) {
  const pathname = usePathname() ?? ''

  return (
    <nav className="border-b border-border">
      <div className="flex px-4 max-w-3xl mx-auto">
        {tabs(patientId).map(({ label, href, icon: Icon, isActive }) => {
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
