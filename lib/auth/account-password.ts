import 'server-only'

import { createClient } from '@supabase/supabase-js'

// Re-authenticating with the account password is how a caller proves they are
// the account-holder (global scope over profile PINs, SYSTEM_DESIGN §D) — the
// session alone proves nothing, because the whole family shares one login.
// Uses a throwaway non-persisting client so the check never touches the
// session cookies of the person currently browsing.
export async function verifyAccountPassword(email: string, password: string): Promise<boolean> {
  const bare = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error } = await bare.auth.signInWithPassword({ email, password })
  return error === null
}
