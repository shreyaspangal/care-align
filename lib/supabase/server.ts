import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Used in: Server Components, Server Actions, Route Handlers.
// Next.js 16: cookies() is async — this function must be awaited by every caller.
// Pattern: const supabase = await createClient()
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Writes refreshed auth tokens back to the cookie store.
          // Throws in pure Server Components (read-only cookies) — caught and
          // ignored here. proxy.ts handles session refresh on every navigation.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context — intentionally ignored.
          }
        },
      },
    }
  )
}
