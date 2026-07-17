import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ProfileColor, Sex } from '@/lib/types/domain'

// pin_hash NEVER leaves the DAL — client-bound queries expose hasPin only
// (the PIN is a privacy lock within the family; see SYSTEM_DESIGN §D).
export type ProfileSummary = {
  id: string
  name: string
  dob: string | null
  sex: Sex | null
  color: ProfileColor
  hasPin: boolean
}

const PROFILE_COLUMNS = 'id, name, dob, sex, color, pin_hash'

type ProfileRow = {
  id: string
  name: string
  dob: string | null
  sex: Sex | null
  color: ProfileColor
  pin_hash: string | null
}

function toSummary(row: ProfileRow): ProfileSummary {
  return {
    id: row.id,
    name: row.name,
    dob: row.dob,
    sex: row.sex,
    color: row.color,
    hasPin: row.pin_hash !== null,
  }
}

export const getProfiles = cache(async (): Promise<ProfileSummary[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: true })
  return ((data ?? []) as ProfileRow[]).map(toSummary)
})

export const getProfile = cache(async (profileId: string): Promise<ProfileSummary | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', profileId)
    .maybeSingle()
  return data ? toSummary(data as ProfileRow) : null
})
