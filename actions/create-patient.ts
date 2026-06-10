'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { CreatePatientSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('createPatient')

export type CreatePatientState = { error: string } | null

export async function createPatient(
  _prev: CreatePatientState,
  formData: FormData
): Promise<CreatePatientState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  log.debug('createPatient', 'user authenticated', { userId: user.id })

  // Verify the caller is a coordinator by role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'coordinator') {
    log.warn('createPatient', 'non-coordinator attempted to create patient', {
      userId: user.id,
      role: profile?.role,
    })
    return { error: 'Only coordinators can add patients.' }
  }

  const raw = {
    name: formData.get('name'),
    dob: formData.get('dob'),
    gender: formData.get('gender'),
    admission_status: formData.get('admission_status'),
  }

  log.debug('createPatient', 'validating form input', { name: raw.name, gender: raw.gender })

  const parsed = CreatePatientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Use service client for patient insert — RLS requires a patient_access row
  // to already exist, but we can't create that until the patient exists.
  // Service client breaks the chicken-and-egg; access grant is created immediately after.
  const service = createServiceClient()

  const { data: patient, error: patientError } = await service
    .from('patients')
    .insert({
      name: parsed.data.name,
      date_of_birth: parsed.data.dob,
      gender: parsed.data.gender,
      admission_status: parsed.data.admission_status,
    })
    .select('id')
    .single()

  if (patientError || !patient) {
    log.error('createPatient', 'patient insert failed', {
      error: patientError?.message,
      code: patientError?.code,
    })
    return { error: 'Failed to create patient record. Please try again.' }
  }

  log.info('createPatient', 'patient record created', { patientId: patient.id })

  // Grant coordinator access — from this point RLS works for all future queries
  const { error: accessError } = await service
    .from('patient_access')
    .insert({ user_id: user.id, patient_id: patient.id, role: 'coordinator' })

  if (accessError) {
    log.error('createPatient', 'access grant failed — rolling back patient', {
      patientId: patient.id,
      error: accessError.message,
    })
    await service.from('patients').delete().eq('id', patient.id)
    return { error: 'Failed to set up access. Please try again.' }
  }

  log.info('createPatient', 'access grant created', { patientId: patient.id, userId: user.id })

  // Create active episode — non-fatal if this fails
  const { error: episodeError } = await service
    .from('episodes')
    .insert({
      patient_id: patient.id,
      started_at: new Date().toISOString().split('T')[0],
      status: 'active',
    })

  if (episodeError) {
    log.warn('createPatient', 'episode creation failed (non-fatal)', {
      patientId: patient.id,
      error: episodeError.message,
    })
  } else {
    log.info('createPatient', 'active episode created', { patientId: patient.id })
  }

  redirect(`/dashboard/${patient.id}`)
}
