'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS entirely.
// Use ONLY for operations that cannot pass RLS by design
// (e.g. creating a patient before the access grant exists).
// Never expose this client or its key to the browser.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
