import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type Family = {
  id: string
  name: string
}

// The only place pages/layouts read the families table (Hard Rule 8).
// cache()-wrapped: deduplicated within a single render pass.
export const getFamily = cache(async (): Promise<Family | null> => {
  const supabase = await createClient()
  const { data } = await supabase.from('families').select('id, name').maybeSingle()
  return data
})
