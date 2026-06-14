'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { UpdateEpisodeStatusSchema, VALID_EPISODE_TRANSITIONS } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import type { EpisodeStatus } from '@/lib/types/domain'

const log = createLogger('updateEpisodeStatus')

export type UpdateEpisodeStatusResult = { ok: true } | { ok: false; error: string }

export async function updateEpisodeStatus(
  episodeId: string,
  newStatus: 'care_complete' | 'closed',
): Promise<UpdateEpisodeStatusResult> {
  const parsed = UpdateEpisodeStatusSchema.safeParse({ episodeId, newStatus })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  // Fetch episode + patient to verify coordinator access and current status
  const { data: episode } = await supabase
    .from('episodes')
    .select('id, status, patient_id')
    .eq('id', parsed.data.episodeId)
    .single()

  if (!episode) return { ok: false, error: 'Episode not found.' }

  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', episode.patient_id)
    .single()

  if (!access || access.role !== 'coordinator') {
    return { ok: false, error: 'Not authorised to update this episode.' }
  }

  // Validate the transition is legal
  const expectedNew = VALID_EPISODE_TRANSITIONS[episode.status as keyof typeof VALID_EPISODE_TRANSITIONS]
  if (expectedNew !== parsed.data.newStatus) {
    log.warn('updateEpisodeStatus', 'invalid transition', {
      current: episode.status,
      requested: parsed.data.newStatus,
    })
    return { ok: false, error: `Cannot transition from '${episode.status}' to '${parsed.data.newStatus}'.` }
  }

  const { error } = await supabase
    .from('episodes')
    .update({ status: parsed.data.newStatus as EpisodeStatus })
    .eq('id', parsed.data.episodeId)

  if (error) {
    log.error('updateEpisodeStatus', 'update failed', { episodeId, error: error.message })
    return { ok: false, error: 'Failed to update episode status. Please try again.' }
  }

  log.info('updateEpisodeStatus', 'status updated', {
    episodeId,
    from: episode.status,
    to: parsed.data.newStatus,
  })

  revalidatePath(`/dashboard/${episode.patient_id}`)
  revalidatePath(`/dashboard/${episode.patient_id}/tasks`)

  return { ok: true }
}
