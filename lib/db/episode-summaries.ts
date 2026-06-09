import type { SupabaseClient } from '@supabase/supabase-js'

export type EpisodeSummaryOutput = {
  visit_purpose: string
  timeline_summary: string
  status_label: string
  status_description: string
}

// Wraps the upsert_episode_summary Postgres RPC.
// Never use supabase.from('episode_summaries').upsert() directly — the JS client
// would reset `version` to the value you pass in rather than incrementing it.
// The RPC does: INSERT ... ON CONFLICT DO UPDATE SET version = version + 1.
export async function upsertEpisodeSummary(
  supabase: SupabaseClient,
  episodeId: string,
  summary: EpisodeSummaryOutput
): Promise<void> {
  const { error } = await supabase.rpc('upsert_episode_summary', {
    p_episode_id: episodeId,
    p_visit_purpose: summary.visit_purpose,
    p_timeline_summary: summary.timeline_summary,
    p_status_label: summary.status_label,
    p_status_description: summary.status_description,
  })
  if (error) throw error
}
