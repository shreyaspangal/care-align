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
  pinned_at: string | null
}

export const getPatientAccess = cache(async (patientId: string): Promise<{ role: string } | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()
  return data ?? null
})

export const getFirstPatientId = cache(async (userId: string): Promise<string | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patient_access')
    .select('patient_id')
    .eq('user_id', userId)
    .eq('role', 'patient')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.patient_id ?? null
})

export const getPatientAccessCount = cache(async (patientId: string, role: 'coordinator' | 'patient'): Promise<number> => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('patient_access')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('role', role)
  return count ?? 0
})

// Cached per request — if called from both the sidebar layout and the
// dashboard page in the same render, Supabase is only hit once.
// Sort: pinned first, then by most recent access row (proxy for activity).
// Closed-episode patients are returned but marked — sidebar filters them out.
export const getCoordinatorPatients = cache(async (userId: string): Promise<PatientListItem[]> => {
  const supabase = await createClient()

  const { data: accessRows } = await supabase
    .from('patient_access')
    .select(`pinned_at, patients(id, name, admission_status, date_of_birth)`)
    .eq('user_id', userId)
    .eq('role', 'coordinator')
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return (accessRows ?? []).flatMap(r => {
    const p = Array.isArray(r.patients) ? r.patients[0] : r.patients
    if (!p) return []
    return [{ ...p, pinned_at: r.pinned_at ?? null }]
  })
})
