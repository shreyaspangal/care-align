'use server'

import { SearchQuerySchema } from '@/lib/validation/schemas'
import { searchDocuments as searchDocumentsDal } from '@/lib/dal/search'
import type { DocumentSummary } from '@/lib/dal/documents'

export type SearchResult =
  | { success: true; items: DocumentSummary[] }
  | { success: false; error: string }

export async function searchDocuments(input: { profileId: string; query: string }): Promise<SearchResult> {
  const parsed = SearchQuerySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const items = await searchDocumentsDal(parsed.data.profileId, parsed.data.query)
  return { success: true, items }
}
