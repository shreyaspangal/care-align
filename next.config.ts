import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Must match MAX_FILE_SIZE_BYTES in lib/validation/schemas.ts (10 MB).
      // Default is 1 MB — medical PDFs routinely exceed that.
      bodySizeLimit: '10mb',
    },
  },
  async rewrites() {
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!posthogHost) return []

    return [
      { source: '/ingest/static/:path*', destination: `${posthogHost}/static/:path*` },
      { source: '/ingest/array/:path*', destination: `${posthogHost}/array/:path*` },
      { source: '/ingest/:path*', destination: `${posthogHost}/:path*` },
    ]
  },
  skipTrailingSlashRedirect: true,
}

export default nextConfig
