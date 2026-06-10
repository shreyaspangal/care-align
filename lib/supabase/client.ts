'use client'

import { createBrowserClient } from '@supabase/ssr'

// Used in: Client Components only (anything with 'use client').
// Uses the publishable key — safe to expose in the browser.
// RLS enforces access control; the anon key alone grants nothing.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
