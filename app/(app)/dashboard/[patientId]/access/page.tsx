import { notFound } from 'next/navigation'
import { getPatientAccess, getPatientCoordinators } from '@/lib/dal/patients'
import { CoordinatorAccessList } from '@/components/features/CoordinatorAccessList'
import { revokeCoordinatorAccess } from '@/actions/revoke-coordinator-access'

type Props = {
  params: Promise<{ patientId: string }>
}

// Patient-only: who currently has coordinator access to this record, and a
// way to revoke it independently of whoever granted it. See
// docs/PRIVACY_TRUST_RESEARCH.md — this is the concrete mitigation for the
// "no institutional gatekeeper" gap relative to MyChart's model.
export default async function PatientDetailAccessPage({ params }: Props) {
  const { patientId } = await params

  const access = await getPatientAccess(patientId)
  if (!access || access.role !== 'patient') notFound()

  const coordinators = await getPatientCoordinators(patientId)

  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Who has access to your care record</h2>
        <p className="text-xs text-muted-foreground">
          Anyone listed here can view and manage your uploaded documents. You can revoke access at any time.
        </p>
      </div>

      <CoordinatorAccessList
        patientId={patientId}
        coordinators={coordinators}
        onRevoke={revokeCoordinatorAccess}
      />
    </div>
  )
}
