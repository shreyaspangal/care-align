'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('revoke-coordinator-access')

type RevokeResult = { ok: true } | { ok: false; error: string }

// Patient revokes a specific coordinator's access to their own record.
// Unconditional and bilateral — does not require the coordinator's
// cooperation. Real enforcement is the RLS DELETE policy added in
// 20260702000000_patient_access_provenance_and_revocation.sql; the role
// check here only produces a clean error message.
export async function revokeCoordinatorAccess(
  patientId: string,
  coordinatorUserId: string,
): Promise<RevokeResult> {
  if (!z.uuid().safeParse(patientId).success || !z.uuid().safeParse(coordinatorUserId).success) {
    return { ok: false, error: 'Invalid identifier.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const { data: myAccess } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!myAccess || myAccess.role !== 'patient') {
    return { ok: false, error: "Only the patient can revoke a coordinator's access." }
  }

  // .select() after .delete() surfaces the "0 rows affected" silent-failure
  // shape explicitly — RLS blocking the delete looks identical to success
  // otherwise (see CLAUDE.md's silent-failure rules).
  const { data: deleted, error } = await supabase
    .from('patient_access')
    .delete()
    .eq('patient_id', patientId)
    .eq('user_id', coordinatorUserId)
    .eq('role', 'coordinator')
    .select('id')

  if (error || !deleted || deleted.length === 0) {
    log.error('revoke-coordinator', 'delete affected 0 rows or errored', {
      patientId, coordinatorUserId, error: error?.message,
    })
    return { ok: false, error: 'Could not revoke access. Please try again.' }
  }

  log.info('revoke-coordinator', 'coordinator access revoked by patient', { patientId, coordinatorUserId })
  return { ok: true }
}
