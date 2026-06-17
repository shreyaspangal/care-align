'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type PatientViewTabNavProps = {
  patientId: string
}

export function PatientViewTabNav({ patientId }: PatientViewTabNavProps) {
  const pathname  = usePathname() ?? ''
  const onSummary = pathname.includes('/summary')

  return (
    <nav className="border-b border-border">
      <div className="flex px-4 max-w-xl mx-auto">
        {[
          { label: 'Summary',   href: `/patient/${patientId}/summary`,  icon: Sparkles,  active: onSummary  },
          { label: 'Documents', href: `/patient/${patientId}`,          icon: FileText,  active: !onSummary },
        ].map(({ label, href, icon: Icon, active }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              'inline-flex items-center gap-1.5 py-3 px-1 mr-5 text-sm border-b-2 transition-colors',
              active
                ? 'border-brand-base text-brand-base font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon size={14} strokeWidth={active ? 2.5 : 1.75} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
