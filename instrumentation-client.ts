import posthog, { type CaptureResult } from 'posthog-js'

type StackFrame = { in_app?: boolean }
type CapturedException = {
  mechanism?: { synthetic?: boolean }
  stacktrace?: { frames?: StackFrame[] }
}

// Browser extensions and embedded preview hosts (e.g. Office link previews) reject
// promises with plain string values on pages we never instrumented. PostHog wraps each
// as a synthetic exception with no application stack frame. Drop that class so third-party
// noise never opens error-tracking issues. Real errors carry application frames and pass through.
function withoutExtensionNoise(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== '$exception') return event

  const exceptions = event.properties?.$exception_list as CapturedException[] | undefined
  if (!exceptions?.length) return event

  const everyExceptionIsNoise = exceptions.every((exception) => {
    const isSynthetic = exception.mechanism?.synthetic === true
    const hasAppFrame = exception.stacktrace?.frames?.some((frame) => frame.in_app === true) ?? false
    return isSynthetic && !hasAppFrame
  })

  return everyExceptionIsNoise ? null : event
}

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: '/ingest',
  // Behind the first-party proxy, toolbar/app links need the real UI origin.
  ui_host: 'https://eu.posthog.com',
  defaults: '2026-05-30',
  capture_exceptions: true,
  before_send: withoutExtensionNoise,
})
