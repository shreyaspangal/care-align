'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { createLogger } from '@/lib/logger'

const log = createLogger('createEpisode')

export type CreateEpisodeResult = { error: string } | { ok: true }

export async function createEpisode(patientId: string): Promise<CreateEpisodeResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Verify coordinator access to this patient via RLS
  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!access || access.role !== 'coordinator') {
    log.warn('createEpisode', 'unauthorized attempt', { userId: user.id, patientId })
    return { error: 'Not authorised.' }
  }

  // Check no active episode already exists
  const { data: existing } = await supabase
    .from('episodes')
    .select('id')
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) {
    log.warn('createEpisode', 'active episode already exists', { patientId })
    return { error: 'An active episode already exists for this patient.' }
  }

  const service = createServiceClient()

  const { error } = await service
    .from('episodes')
    .insert({
      patient_id: patientId,
      started_at: new Date().toISOString().split('T')[0],
      status: 'active',
    })

  if (error) {
    log.error('createEpisode', 'insert failed', { patientId, error: error.message })
    return { error: 'Failed to create episode. Please try again.' }
  }

  log.info('createEpisode', 'episode created', { patientId })
  revalidatePath(`/dashboard/${patientId}`)
  return { ok: true }
}
