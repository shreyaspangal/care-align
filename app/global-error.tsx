'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import './globals.css'

// Last-resort boundary: only fires when the root layout itself throws, so it
// must render its own <html>/<body> and can't lean on ThemeProvider or any
// other provider that could be the thing that failed.
export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground antialiased">
        <h1 className="text-lg font-medium">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your documents are safe — this was a problem loading CareAlign. Try again, or come back
          in a moment.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
