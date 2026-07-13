// Pure function, no Node-only or secret-bearing code — deliberately not
// marked 'server-only' so it stays unit-testable outside a Next.js server
// context. Both call sites (proxy.ts, actions/auth.ts) are server-only files
// themselves anyway.
export type AccessRow = { patient_id: string }

// Given every patient_access row a user holds (any role), decide where they
// should land. Exactly one record → skip the list, go straight there. Zero or
// several → the /dashboard shell (list, empty state, or "add your first
// patient" form) is the correct landing spot in every other case.
// Shared by proxy.ts and actions/auth.ts so the two don't drift independently.
export function resolveHomePath(accessRows: AccessRow[]): string {
  if (accessRows.length === 1) {
    return `/dashboard/${accessRows[0].patient_id}/summary`
  }
  return '/dashboard'
}
