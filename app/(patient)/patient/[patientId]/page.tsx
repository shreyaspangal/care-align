import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function PatientViewPage({ params }: Props) {
  const { patientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify user has patient-role access to this patient record
  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!access || access.role !== 'patient') notFound()

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

  const episode = episodes?.[0] ?? null

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hello, {patient.name.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here is what is happening with your care.
        </p>
      </div>

      {episode ? (
        <div className="rounded-xl border bg-card p-6 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Your current hospitalisation</p>
          <p className="text-sm">
            Started{' '}
            {new Date(episode.started_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Your coordinator is uploading your documents. Explanations will appear here shortly.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground text-sm">
          No active episode. Contact your coordinator for details.
        </div>
      )}
    </div>
  )
}
