import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PatientTabNav } from '@/components/features/PatientTabNav'
import { PatientInviteButton } from '@/components/features/PatientInviteButton'
import { RevokeAccessButton } from '@/components/features/RevokeAccessButton'
import { SelfRevokeCoordinatorButton } from '@/components/features/SelfRevokeCoordinatorButton'
import { getPatient, getPatientAccess, getPatientAccessCount } from '@/lib/dal/patients'
import { getActiveEpisode } from '@/lib/dal/episodes'
import { getEpisodeDocuments } from '@/lib/dal/documents'
import { createInvite } from '@/actions/create-invite'
import { revokePatientAccess } from '@/actions/revoke-patient-access'
import { selfRevokeCoordinatorAccess } from '@/actions/self-revoke-coordinator-access'

type Props = {
  children: ReactNode
  params: Promise<{ patientId: string }>
}

// One layout for any role — permission-aware, not a separate route tree.
// getPatientAccess(patientId) is the per-record gate: absent access shows a
// friendly message rather than rendering the record (Hard Rule 12's layout
// auth-gate rule), and the caller's role decides which controls/tabs render.
export default async function PatientDetailLayout({ children, params }: Props) {
  const { patientId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const patient = await getPatient(patientId)
  if (!patient) notFound()

  const access = await getPatientAccess(patientId)

  if (!access) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center space-y-2">
        <p className="text-sm font-medium">Your access to this care record has ended.</p>
        <p className="text-xs text-muted-foreground">
          Contact whoever manages this record to receive a new link and regain access.
        </p>
      </div>
    )
  }

  const activeEpisode = await getActiveEpisode(patientId)

  let hospitalName: string | null = null
  if (activeEpisode) {
    const docs = await getEpisodeDocuments(activeEpisode.id)
    hospitalName = docs.find(d => d.source_hospital)?.source_hospital ?? null
  }

  const episodeDate = activeEpisode?.started_at
    ? new Date(activeEpisode.started_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  if (access.role === 'patient') {
    return (
      <div className="flex flex-col">
        {(hospitalName || episodeDate) && (
          <div className="max-w-xl mx-auto w-full px-4 pt-5 pb-1">
            <p className="text-base font-semibold text-foreground">
              {hospitalName ?? 'Your care'}
            </p>
            {episodeDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Episode started {episodeDate}
              </p>
            )}
          </div>
        )}

        <PatientTabNav patientId={patientId} role="patient" />
        <div>{children}</div>
      </div>
    )
  }

  const patientAccessCount = await getPatientAccessCount(patientId, 'patient')
  const hasPatientAccess = patientAccessCount > 0

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
            {hasPatientAccess && (
              <RevokeAccessButton
                patientName={patient.name}
                patientId={patientId}
                onRevoke={revokePatientAccess}
              />
            )}
            <PatientInviteButton
              patientId={patientId}
              patientName={patient.name}
              onCreateInvite={createInvite}
            />
            <SelfRevokeCoordinatorButton
              patientName={patient.name}
              patientId={patientId}
              onSelfRevoke={selfRevokeCoordinatorAccess}
            />
          </div>
        </div>
      </div>

      <PatientTabNav patientId={patientId} role="coordinator" />
      <div>{children}</div>
    </div>
  )
}
