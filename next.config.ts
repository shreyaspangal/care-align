import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Must match MAX_FILE_SIZE_BYTES in lib/validation/schemas.ts (10 MB).
      // Default is 1 MB — medical PDFs routinely exceed that.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
