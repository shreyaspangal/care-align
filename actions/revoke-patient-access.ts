'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'

const log = createLogger('revoke-patient-access')

type RevokeResult = { ok: true } | { ok: false; error: string }

export async function revokePatientAccess(patientId: string): Promise<RevokeResult> {
  if (!z.uuid().safeParse(patientId).success) {
    return { ok: false, error: 'Invalid patient identifier.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!access || access.role !== 'coordinator') {
    return { ok: false, error: 'Not authorised to revoke access for this patient.' }
  }

  const service = createServiceClient()

  // Delete all patient-role access rows and expire all pending invites
  const [{ error: deleteError }, { error: expireError }] = await Promise.all([
    service
      .from('patient_access')
      .delete()
      .eq('patient_id', patientId)
      .eq('role', 'patient'),
    service
      .from('patient_invites')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('patient_id', patientId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString()),
  ])

  if (deleteError || expireError) {
    log.error('revoke', 'revoke failed', {
      deleteError: deleteError?.message,
      expireError: expireError?.message,
    })
    return { ok: false, error: 'Could not revoke access. Please try again.' }
  }

  log.info('revoke', 'patient access revoked', { patientId })
  return { ok: true }
}
