import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { UserRole, AccessProvenance } from '@/lib/types/domain'

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

export const getPatientAccessCount = cache(async (patientId: string, role: 'coordinator' | 'patient'): Promise<number> => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('patient_access')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('role', role)
  return count ?? 0
})

export type MyAccessListItem = {
  id: string
  name: string
  admission_status: string
  date_of_birth: string
  pinned_at: string | null
  role: UserRole
}

// Cached per request — if called from both the shell layout and the
// dashboard page in the same render, Supabase is only hit once.
// Every patient_access row the caller holds, both roles — this is the
// unified "my people" list (replaces the old coordinator-only list and the
// single-row patient lookup; one login, one list, permission per record).
// Sort: pinned first, then by most recent access row (proxy for activity).
// Closed-episode patients are returned but marked — the sidebar filters them out.
export const getMyAccessList = cache(async (userId: string): Promise<MyAccessListItem[]> => {
  const supabase = await createClient()

  const { data: accessRows } = await supabase
    .from('patient_access')
    .select(`role, pinned_at, patients(id, name, admission_status, date_of_birth)`)
    .eq('user_id', userId)
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return (accessRows ?? []).flatMap(r => {
    const p = Array.isArray(r.patients) ? r.patients[0] : r.patients
    if (!p) return []
    return [{ ...p, pinned_at: r.pinned_at ?? null, role: r.role }]
  })
})

export type PatientCoordinator = {
  userId: string
  name: string | null
  provenance: AccessProvenance
  grantedAt: string
}

// "Who has access to this record" — consumed by the patient-visible access
// list. Relies on the two RLS policies added in
// 20260702000000_patient_access_provenance_and_revocation.sql (patient can
// SELECT coordinator rows for their own patient_id; profiles SELECT for
// co-access users). Returns [] for a coordinator caller today — a
// coordinator-facing "care team" view is a separate, later feature.
export const getPatientCoordinators = cache(async (patientId: string): Promise<PatientCoordinator[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patient_access')
    .select(`user_id, provenance, created_at, profiles(name)`)
    .eq('patient_id', patientId)
    .eq('role', 'coordinator')
    .order('created_at', { ascending: true })

  return (data ?? []).map(r => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      userId: r.user_id,
      name: profile?.name ?? null,
      provenance: r.provenance,
      grantedAt: r.created_at,
    }
  })
})
