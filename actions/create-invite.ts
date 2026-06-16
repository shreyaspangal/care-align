'use server'

import { z } from 'zod'
import { hash } from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'

const log = createLogger('create-invite')

export type CreateInviteResult =
  | { ok: true; url: string; pin: string | null }
  | { ok: false; error: string }

function generatePin(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

export async function createInvite(
  patientId: string,
  requirePin: boolean = true,
): Promise<CreateInviteResult> {
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
    return { ok: false, error: 'Not authorised to invite for this patient.' }
  }

  // Expire all pending (unredeemed) invites for this patient so only one link
  // is valid at a time. Existing patient_access is intentionally preserved —
  // patients who already redeemed keep their access. Use revokePatientAccess()
  // to explicitly remove access from a previous recipient.
  const service = createServiceClient()
  await service
    .from('patient_invites')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('patient_id', patientId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())

  const pin = requirePin ? generatePin() : null
  const pinHash = pin ? await hash(pin, 10) : null

  const { data: invite, error } = await supabase
    .from('patient_invites')
    .insert({ patient_id: patientId, created_by: user.id, pin_hash: pinHash })
    .select('token')
    .single()

  if (error || !invite) {
    log.error('create-invite', 'insert failed', { patientId, error: error?.message })
    return { ok: false, error: 'Could not generate invite link. Please try again.' }
  }

  log.info('create-invite', 'invite created', {
    patientId,
    token: invite.token.slice(0, 8),
    requirePin,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    log.error('create-invite', 'NEXT_PUBLIC_APP_URL is not set')
    return { ok: false, error: 'Server configuration error. Contact support.' }
  }

  const url = `${appUrl}/join/${invite.token}`
  return { ok: true, url, pin }
}
