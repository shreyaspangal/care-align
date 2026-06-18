'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function togglePinPatient(
  patientId: string,
  currentlyPinned: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!z.uuid().safeParse(patientId).success) {
    return { ok: false, error: 'Invalid patient identifier.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  // Verify the caller is a coordinator for this patient before touching the row.
  const { data: access } = await supabase
    .from('patient_access')
    .select('id')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .eq('role', 'coordinator')
    .single()

  if (!access) return { ok: false, error: 'Not authorised to pin this patient.' }

  // patient_access has no UPDATE RLS policy — service client required.
  const service = createServiceClient()
  const { error } = await service
    .from('patient_access')
    .update({ pinned_at: currentlyPinned ? null : new Date().toISOString() })
    .eq('id', access.id)

  if (error) return { ok: false, error: 'Could not update pin. Please try again.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}
