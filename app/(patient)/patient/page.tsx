import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFirstPatientId } from '@/lib/dal/patients'

export default async function PatientIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const patientId = await getFirstPatientId(user.id)
  if (patientId) redirect(`/patient/${patientId}`)

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-xl font-semibold">Welcome to CareAlign</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Your care record hasn&apos;t been set up yet. Contact your coordinator
        to get access.
      </p>
    </div>
  )
}
