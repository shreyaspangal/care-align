import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveHomePath } from '@/lib/auth/resolve-home-path'

// Next.js 16: this file replaces middleware.ts. Export must be named `proxy`.
// Runs on every matched request (nodejs runtime, not edge).
// Two jobs:
//   1. Keep the Supabase auth session alive by refreshing tokens on every request.
//   2. Route a logged-in user to their home path at /, /login, /register.
// Per-record access (who can see /dashboard/{patientId}) is NOT this file's
// job — every per-patient page/layout already checks getPatientAccess(patientId)
// itself. One shell, one route tree; permissions are per record, not per path.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Start with a response that passes the request through unchanged.
  // Supabase SSR needs to write refreshed tokens into this response's cookies.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write refreshed tokens into both the request (for downstream Server
          // Components in this request) and the response (for the browser).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT server-side — never use getSession() here.
  // getSession() only reads the cookie without verifying it, which is unsafe
  // in a routing guard context.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Rule 1: no session → redirect to /login (except auth pages and the public join page)
  if (
    !user &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/register') &&
    !pathname.startsWith('/join')
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register'))) {
    const { data: accessRows } = await supabase
      .from('patient_access')
      .select('patient_id')
      .eq('user_id', user.id)

    return NextResponse.redirect(new URL(resolveHomePath(accessRows ?? []), request.url))
  }

  return response
}

export const config = {
  // Run on all routes except Next.js internals and the authenticated file-serving
  // API route (which does its own auth check via RLS).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
