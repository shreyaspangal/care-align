import posthog from 'posthog-js'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: '/ingest',
  // Behind the first-party proxy, toolbar/app links need the real UI origin.
  ui_host: 'https://eu.posthog.com',
  defaults: '2026-05-30',
  capture_exceptions: true,
})
