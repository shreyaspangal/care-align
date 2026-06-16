import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { PatientTabNav } from '@/components/features/PatientTabNav'
import { getPatient } from '@/lib/dal/patients'

type Props = {
  children: ReactNode
  params: Promise<{ patientId: string }>
}

export default async function PatientDetailLayout({ children, params }: Props) {
  const { patientId } = await params
  const patient = await getPatient(patientId)
  if (!patient) notFound()

  return (
    <div className="flex flex-col">
      {/* Patient header — scoped to content width */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-6 pb-4 space-y-1">
        <Link
          href="/dashboard"
          className="lg:hidden inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All patients
        </Link>
        <h1 className="text-xl font-semibold">{patient.name}</h1>
        <p className="text-sm text-muted-foreground capitalize">
          {patient.admission_status.replace('_', ' ')}
        </p>
      </div>

      {/* Tabs — no bg, border-b only */}
      <PatientTabNav patientId={patientId} />

      <div>{children}</div>
    </div>
  )
}
