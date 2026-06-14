import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { EpisodeStatus, TaskCategory } from '@/lib/types/domain'

export type EpisodeSummaryRow = {
  visit_purpose: string
  timeline_summary: string
  status_label: string
  status_description: string
  version: number
  updated_at: string
}

export type ActiveEpisode = {
  id: string
  status: EpisodeStatus
  started_at: string
}

export type TaskCount = {
  category: TaskCategory
  count: number
}

/**
 * Returns the most recent episode for a patient, or null if none exists.
 * Per-request cached — multiple Server Components can call this without a double round-trip.
 */
export const getActiveEpisode = cache(async (patientId: string): Promise<ActiveEpisode | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('episodes')
    .select('id, status, started_at')
    .eq('patient_id', patientId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  return data ?? null
})

/**
 * Returns the episode summary, or null if none has been generated yet
 * (e.g. before the first document is uploaded).
 */
export const getEpisodeSummary = cache(async (episodeId: string): Promise<EpisodeSummaryRow | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('episode_summaries')
    .select('visit_purpose, timeline_summary, status_label, status_description, version, updated_at')
    .eq('episode_id', episodeId)
    .is('deleted_at', null)
    .single()

  return data ?? null
})

/**
 * Returns open pending task counts grouped by category for the episode.
 * Empty array means no open tasks.
 */
export const getOpenTaskCounts = cache(async (episodeId: string): Promise<TaskCount[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pending_tasks')
    .select('category')
    .eq('episode_id', episodeId)
    .eq('status', 'open')
    .is('deleted_at', null)

  if (!data) return []

  const counts = new Map<TaskCategory, number>()
  for (const row of data) {
    const cat = row.category as TaskCategory
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([category, count]) => ({ category, count }))
})
