import * as z from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDocumentFile } from '@/lib/dal/documents'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:documents:file')

// Hard Rule 7: no raw storage URLs reach the client. The client only ever
// links here; this route checks family membership (via RLS on the
// getDocumentFile select) before minting a short-lived signed URL.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params
  const parsed = z.uuid().safeParse(documentId)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid document' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // RLS scopes this to the caller's family — a null row means either the
  // document doesn't exist or belongs to another family, and we don't
  // distinguish the two to the client.
  const file = await getDocumentFile(documentId)
  if (!file) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(file.blobKey, 60)
  if (error || !data) {
    log.error('file', 'createSignedUrl failed', { documentId, error: error?.message })
    return NextResponse.json({ error: 'Could not load the file' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
