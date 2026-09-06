// Client-side re-encode for photo captures (D-003 upload flow). Runs before
// the signed-URL request so the byte size/mime the server signs for matches
// what actually gets uploaded.
//
// createImageBitmap with imageOrientation: 'from-image' applies EXIF rotation
// while decoding; drawing the result to a canvas and re-encoding produces a
// plain JPEG with no EXIF block at all — orientation is baked into the pixels,
// not carried as metadata, and nothing else in the original EXIF (GPS, device
// info) survives the round-trip.

const MAX_EDGE = 2000
const JPEG_QUALITY = 0.85

export type EncodedImage = {
  blob: Blob
  width: number
  height: number
}

export async function encodeImageForUpload(file: File): Promise<EncodedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  )
  if (!blob) throw new Error('Could not encode image')

  return { blob, width, height }
}
