import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function CoordinatorDashboardPage({ params }: Props) {
  const { patientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify coordinator has access to this patient
  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!access || access.role !== 'coordinator') notFound()

  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, admission_status')
    .eq('id', patientId)
    .single()

  if (!patient) notFound()

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, status, started_at')
    .eq('patient_id', patientId)
    .order('started_at', { ascending: false })
    .limit(1)

  const activeEpisode = episodes?.[0] ?? null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{patient.name}</h1>
        <p className="text-sm text-muted-foreground capitalize">
          {patient.admission_status.replace('_', ' ')}
        </p>
      </div>

      {activeEpisode ? (
        <div className="rounded-xl border bg-card p-6 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Active Episode</p>
          <p className="text-sm">
            Started{' '}
            {new Date(activeEpisode.started_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Documents and AI translation will appear here once uploaded.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground text-sm">
          No active episode. Create one to start uploading documents.
        </div>
      )}
    </div>
  )
}
