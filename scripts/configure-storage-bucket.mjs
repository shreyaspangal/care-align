/**
 * One-off setup script: locks down the private 'documents' Supabase Storage
 * bucket to only accept the file types and size we actually validate in
 * lib/validation/schemas.ts (RequestUploadSchema / CreateDocumentSchema).
 *
 * Why this needs to exist at all: the client-upload flow (D-003) PUTs bytes
 * straight from the browser to Supabase Storage — our server never sees them.
 * Our Zod schema only checks size/type AFTER the file already landed in
 * storage (in createDocument). Without this bucket-level config, a client
 * could still upload an oversized or wrong-type file; it would just get
 * rejected one step later, leaving an orphaned file in storage. Configuring
 * the same limits on the bucket itself means Supabase refuses the upload
 * before it happens.
 *
 * Run: node scripts/configure-storage-bucket.mjs
 * (uses .env.local locally, or real env vars in CI/production)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadLocalEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const eq = line.indexOf('=')
      if (eq === -1 || line.startsWith('#')) continue
      const key = line.slice(0, eq).trim()
      const value = line.slice(eq + 1).split('#')[0].trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // no .env.local — env must come from the environment (CI)
  }
}

loadLocalEnv()

// Kept in sync by hand with lib/validation/schemas.ts (UPLOAD_MIME_TYPES,
// MAX_UPLOAD_BYTES) — this file can't import that one, it's plain Node with
// no TypeScript build step.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.storage.updateBucket('documents', {
  public: false,
  fileSizeLimit: MAX_UPLOAD_BYTES,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
})

if (error) {
  console.error('Failed to configure the documents bucket:', error.message)
  process.exit(1)
}

console.log('documents bucket configured:', data)
