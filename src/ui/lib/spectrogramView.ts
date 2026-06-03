// Build a legible false-color (viridis) pixel region from a [0,1] magnitude matrix.
// Matches the encoded image's orientation: frequency runs low->high from the
// bottom row up. Returns a plain PixelRegion; the UI turns it into ImageData.

import type { PixelRegion } from '@/core/image/spectrogram'
import { viridis } from './colormap'

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Map values[frame][bin] (each in [0,1]) to a viridis RGBA region. */
export function magnitudeToFalseColorRegion(values: Float32Array[]): PixelRegion {
  const width = values.length
  const height = width > 0 ? values[0].length : 0
  const rgba = new Uint8ClampedArray(width * height * 4)

  for (let f = 0; f < width; f++) {
    const frame = values[f]
    for (let bin = 0; bin < height; bin++) {
      const ry = height - 1 - bin // bin 0 at the bottom
      const i = (ry * width + f) * 4
      const [r, g, b] = viridis(clamp01(frame[bin]))
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = 255
    }
  }
  return { width, height, rgba }
}
