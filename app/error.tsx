'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'

// Next.js route-segment error boundary. Catches render errors below the root
// layout (which stays intact, so navigation still works). PostHog's
// capture_exceptions autocapture (instrumentation-client.ts) hooks
// window.onerror/unhandledrejection, not React's error-boundary path — this
// is the explicit report that would otherwise never reach PostHog.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    posthog.captureException(error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-medium text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your documents are safe — this was a problem loading the page. Try again, or come back in
        a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  )
}
