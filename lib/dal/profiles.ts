import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type UserProfile = {
  name: string | null
  role: string
}

export const getProfile = cache(async (userId: string): Promise<UserProfile | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', userId)
    .single()
  return data ?? null
})
