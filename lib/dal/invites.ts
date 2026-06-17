import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'

export type InviteRecord = {
  id: string
  patient_id: string
  expires_at: string
  used_at: string | null
  pin_hash: string | null
  pin_locked_at: string | null
  patients: { name: string } | { name: string }[] | null
}

// Uses service client — invites are fetched before the user is authenticated.
export const getInviteByToken = cache(async (token: string): Promise<InviteRecord | null> => {
  const service = createServiceClient()
  const { data } = await service
    .from('patient_invites')
    .select('id, patient_id, expires_at, used_at, pin_hash, pin_locked_at, patients(name)')
    .eq('token', token)
    .maybeSingle()
  return (data as InviteRecord | null) ?? null
})
