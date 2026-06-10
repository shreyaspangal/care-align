'server-only'

import { put, head } from '@vercel/blob'

export async function uploadToBlob(
  file: File,
  episodeId: string,
  documentId: string
): Promise<string> {
  const blob = await put(
    `documents/${episodeId}/${documentId}/${file.name}`,
    file,
    {
      access: 'private',
      contentType: file.type,
    }
  )
  // Store pathname only — never the full URL (CLAUDE.md rule 2)
  return blob.pathname
}

export async function getSignedBlobUrl(fileKey: string): Promise<string> {
  const { url } = await head(fileKey)
  return url
}
