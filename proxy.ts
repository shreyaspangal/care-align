import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16: this file replaces middleware.ts. Export must be named `proxy`.
// Runs on every matched request (nodejs runtime, not edge).
// Two jobs:
//   1. Keep the Supabase auth session alive by refreshing tokens on every request.
//   2. Enforce role-based routing — patients cannot reach coordinator routes and vice versa.
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

  // Rule 1: no session → redirect to /login (except auth pages themselves)
  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Fetch the user's role from profiles — not from the JWT, which may be stale.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Rule 2: patient trying to reach a coordinator route → redirect to their view
    if (role === 'patient' && pathname.startsWith('/dashboard')) {
      const patientId = pathname.split('/')[2]
      if (patientId) {
        return NextResponse.redirect(new URL(`/patient/${patientId}`, request.url))
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Rule 3: coordinator trying to reach a patient-only route → redirect to dashboard
    if (role === 'coordinator' && pathname.startsWith('/patient')) {
      const patientId = pathname.split('/')[2]
      if (patientId) {
        return NextResponse.redirect(new URL(`/dashboard/${patientId}`, request.url))
      }
    }

    // Rule 4: logged-in user hitting /login or /register → send home
    if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  // Run on all routes except Next.js internals and the authenticated file-serving
  // API route (which does its own auth check via RLS).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
