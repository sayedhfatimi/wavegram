// PNG-only image I/O. Lossy formats are rejected because compression artifacts corrupt the
// magnitude values stored in pixel brightness. Format is detected by file signature, not the
// (spoofable / absent) MIME type.

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'unknown'

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false
  }
  return true
}

/** Identify an image by its leading magic bytes. */
export function detectImageFormat(bytes: Uint8Array): ImageFormat {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'webp'
  return 'unknown'
}

/** Throw a user-facing error if the bytes are not a PNG. */
export function assertPng(bytes: Uint8Array): void {
  const fmt = detectImageFormat(bytes)
  if (fmt !== 'png') {
    throw new Error(
      `Only PNG images are accepted. This file looks like ${fmt === 'unknown' ? 'an unsupported format' : fmt.toUpperCase()}; ` +
        `lossy formats corrupt the encoded audio data.`,
    )
  }
}

// --- Browser canvas helpers (exercised in the app, not in the unit suite) ---

/** Decode a PNG File into ImageData. Rejects non-PNG input first. */
export async function fileToImageData(file: File): Promise<ImageData> {
  const buf = new Uint8Array(await file.arrayBuffer())
  assertPng(buf)
  const bitmap = await createImageBitmap(
    new Blob([buf as BlobPart], { type: 'image/png' }),
  )
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not acquire a 2D canvas context')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** Encode ImageData as a PNG Blob. */
export async function imageDataToPngBlob(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not acquire a 2D canvas context')
  ctx.putImageData(imageData, 0, 0)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG encoding failed'))
    }, 'image/png')
  })
}
