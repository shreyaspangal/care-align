import { notFound, redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PatientViewTabNav } from '@/components/features/PatientViewTabNav'
import { getPatient, getPatientAccess } from '@/lib/dal/patients'
import { getActiveEpisode } from '@/lib/dal/episodes'
import { getEpisodeDocuments } from '@/lib/dal/documents'

type Props = {
  children: ReactNode
  params: Promise<{ patientId: string }>
}

export default async function PatientDetailLayout({ children, params }: Props) {
  const { patientId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const patient = await getPatient(patientId)
  if (!patient) notFound()

  const access = await getPatientAccess(patientId)

  if (!access || access.role !== 'patient') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center space-y-2">
        <p className="text-sm font-medium">Your access to this care record has ended.</p>
        <p className="text-xs text-muted-foreground">
          Contact your coordinator to receive a new link and regain access.
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

      <PatientViewTabNav patientId={patientId} />

      <div>{children}</div>
    </div>
  )
}
