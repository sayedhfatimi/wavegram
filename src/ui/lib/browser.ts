// Small browser-only helpers shared by the UI: pixel<->ImageData and file downloads.

import type { PixelRegion } from '@/core/image/spectrogram'

/** Convert a core PixelRegion into a canvas ImageData. */
export function regionToImageData(region: PixelRegion): ImageData {
  return new ImageData(new Uint8ClampedArray(region.rgba), region.width, region.height)
}

/** Read an ImageData back into a plain RGBA buffer + dimensions. */
export function imageDataToRegion(img: ImageData): PixelRegion {
  return { width: img.width, height: img.height, rgba: img.data }
}

/** Trigger a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoke on the next tick so the download has a chance to start
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
