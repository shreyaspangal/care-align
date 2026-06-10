import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PatientIndexPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: access } = await supabase
    .from('patient_access')
    .select('patient_id')
    .eq('user_id', user.id)
    .eq('role', 'patient')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (access?.patient_id) {
    redirect(`/patient/${access.patient_id}`)
  }

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
