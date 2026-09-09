'use server'

import * as z from 'zod'
import { getTimelinePage, type TimelineCursor, type TimelinePage } from '@/lib/dal/timeline'

const LoadMoreInputSchema = z.object({
  profileId: z.uuid(),
  cursor: z
    .object({
      eventDate: z.iso.date(),
      id: z.uuid(),
    })
    .nullable(),
})

export type LoadMoreTimelineResult =
  | { success: true; page: TimelinePage }
  | { success: false; error: string }

// Thin wrapper: client components can't call server-only DAL functions
// directly (only server actions), and "load more" is a client-triggered
// interaction (IntersectionObserver). getTimelinePage itself already scopes
// to the caller's family via RLS on both underlying table queries.
export async function loadMoreTimelineItems(
  profileId: string,
  cursor: TimelineCursor | null
): Promise<LoadMoreTimelineResult> {
  const parsed = LoadMoreInputSchema.safeParse({ profileId, cursor })
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }
  const page = await getTimelinePage(parsed.data.profileId, parsed.data.cursor)
  return { success: true, page }
}
