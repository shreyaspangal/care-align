'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getPatientAccessCount } from '@/lib/dal/patients'
import { createLogger } from '@/lib/logger'

const log = createLogger('self-revoke-coordinator-access')

type RevokeResult = { ok: true } | { ok: false; error: string }

// A coordinator removes their own access to a patient record ("leave").
// Guarded against orphaning the record: patients RLS requires an existing
// coordinator row, so the last coordinator has no way back in once they
// self-revoke. There is currently no action to add a second coordinator to
// an existing record, so this guard will trigger for nearly every patient
// today — that's expected, not a bug.
export async function selfRevokeCoordinatorAccess(patientId: string): Promise<RevokeResult> {
  if (!z.uuid().safeParse(patientId).success) {
    return { ok: false, error: 'Invalid patient identifier.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const coordinatorCount = await getPatientAccessCount(patientId, 'coordinator')
  if (coordinatorCount <= 1) {
    return {
      ok: false,
      error: "You're the only coordinator for this patient. Removing yourself now would leave nobody able to manage this record.",
    }
  }

  const { data: deleted, error } = await supabase
    .from('patient_access')
    .delete()
    .eq('patient_id', patientId)
    .eq('user_id', user.id)
    .eq('role', 'coordinator')
    .select('id')

  if (error || !deleted || deleted.length === 0) {
    log.error('self-revoke', 'delete affected 0 rows or errored', { patientId, error: error?.message })
    return { ok: false, error: 'Could not remove your access. Please try again.' }
  }

  log.info('self-revoke', 'coordinator self-revoked', { patientId, userId: user.id })
  return { ok: true }
}
