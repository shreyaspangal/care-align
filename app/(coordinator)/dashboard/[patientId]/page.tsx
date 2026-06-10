import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DocumentUploadZone } from '@/components/features/DocumentUploadZone'
import { CreateEpisodeButton } from '@/components/features/CreateEpisodeButton'
import { ArrowLeft } from 'lucide-react'

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
      <div className="space-y-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All patients
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{patient.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {patient.admission_status.replace('_', ' ')}
          </p>
        </div>
      </div>

      {activeEpisode ? (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Active Episode</p>
              <p className="text-xs text-muted-foreground">
                Started{' '}
                {new Date(activeEpisode.started_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <DocumentUploadZone episodeId={activeEpisode.id} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">No active episode for this patient.</p>
          <CreateEpisodeButton patientId={patient.id} />
        </div>
      )}
    </div>
  )
}
