import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { PatientTabNav } from '@/components/features/PatientTabNav'
import { PatientInviteButton } from '@/components/features/PatientInviteButton'
import { RevokeAccessButton } from '@/components/features/RevokeAccessButton'
import { getPatient } from '@/lib/dal/patients'
import { createInvite } from '@/actions/create-invite'
import { revokePatientAccess } from '@/actions/revoke-patient-access'

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
      <div className="max-w-3xl mx-auto w-full px-4 pt-6 pb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All patients
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold">{patient.name}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {patient.admission_status.replace('_', ' ')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <RevokeAccessButton
              patientName={patient.name}
              patientId={patientId}
              onRevoke={revokePatientAccess}
            />
            <PatientInviteButton
              patientId={patientId}
              patientName={patient.name}
              onCreateInvite={createInvite}
            />
          </div>
        </div>
      </div>

      <PatientTabNav patientId={patientId} />
      <div>{children}</div>
    </div>
  )
}
