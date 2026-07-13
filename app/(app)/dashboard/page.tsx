import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyAccessList } from '@/lib/dal/patients'
import { DashboardContent } from './DashboardContent'
import { createPatient } from '@/actions/create-patient'

export default async function DashboardIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const patients = await getMyAccessList(user.id)
  return <DashboardContent patients={patients} onCreatePatient={createPatient} />
}
