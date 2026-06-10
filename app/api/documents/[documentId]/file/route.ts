import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedBlobUrl } from '@/lib/storage/blob'

type Params = { params: Promise<{ documentId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { documentId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS enforces access — coordinators see file_key, patients cannot
  const { data: document, error } = await supabase
    .from('documents')
    .select('file_key')
    .eq('id', documentId)
    .single()

  if (error || !document) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const signedUrl = await getSignedBlobUrl(document.file_key)

  // Redirect to signed URL — expires shortly, never cached by browser
  return NextResponse.redirect(signedUrl, { status: 302 })
}
