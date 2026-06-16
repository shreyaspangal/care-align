import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type PatientDetail = {
  id: string
  name: string
  admission_status: string
}

export const getPatient = cache(async (patientId: string): Promise<PatientDetail | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patients')
    .select('id, name, admission_status')
    .eq('id', patientId)
    .single()
  return data ?? null
})

export type PatientListItem = {
  id: string
  name: string
  admission_status: string
  date_of_birth: string
}

// Cached per request — if called from both the sidebar layout and the
// dashboard page in the same render, Supabase is only hit once.
export const getCoordinatorPatients = cache(async (userId: string): Promise<PatientListItem[]> => {
  const supabase = await createClient()

  const { data: accessRows } = await supabase
    .from('patient_access')
    .select(`patient_id, patients(id, name, admission_status, date_of_birth)`)
    .eq('user_id', userId)
    .eq('role', 'coordinator')
    .order('created_at', { ascending: false })

  return (accessRows ?? [])
    .flatMap(r => (Array.isArray(r.patients) ? r.patients : r.patients ? [r.patients] : []))
    .filter((p): p is PatientListItem => !!p)
})
