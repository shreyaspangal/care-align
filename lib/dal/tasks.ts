import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { TaskCategory, TaskPhase, TaskStatus } from '@/lib/types/domain'

export type EpisodeTask = {
  id: string
  category: TaskCategory
  description: string
  status: TaskStatus
  phase_appears: TaskPhase
  resolved_at: string | null
}

/**
 * Returns all non-deleted tasks for an episode, ordered by category then created_at.
 * Includes both open and resolved tasks — the UI decides what to show.
 */
export const getEpisodeTasks = cache(async (episodeId: string): Promise<EpisodeTask[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pending_tasks')
    .select('id, category, description, status, phase_appears, resolved_at')
    .eq('episode_id', episodeId)
    .is('deleted_at', null)
    .order('category', { ascending: true })
    .order('created_at', { ascending: true })

  return (data ?? []) as EpisodeTask[]
})
