import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Session refresh + auth redirects only — no data access, no business logic.
// Next 16: this file is proxy.ts, NOT middleware.ts (which is silently ignored).

const AUTH_ROUTES = ['/login', '/register']

export async function proxy(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT with Supabase Auth — never trust getSession()
  // here (ANTI_PATTERNS: the cookie alone is client-controlled input).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (isAuthRoute || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/profiles'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Everything except static assets, the favicon, the PostHog ingestion
  // proxy, and the cron keepalive route — /ingest must reach the next.config
  // rewrite unauthenticated, or every logged-out event (register/login
  // pageviews) 307s into /login and is silently dropped (also spares a
  // getUser() round-trip per event batch). /api/cron/keepalive must reach
  // its own CRON_SECRET check unauthenticated — Vercel's scheduler sends no
  // session cookie, so without this exclusion the cron always 307s to
  // /login before the route ever runs (D-015).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|ingest|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
