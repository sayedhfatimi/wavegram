// Compose the final Wavegram image (header strip + spectrogram region) and extract the pieces
// back. The image is width = max(frames, 560) so the header always fits; spectrogram columns are
// left-aligned and any extra width is black-padded. The decoder recomputes the frame count from
// header params, so it reads only the meaningful columns and ignores the padding.

import type { PixelRegion } from './spectrogram'
import {
  MIN_STRIP_WIDTH,
  readHeaderStrip,
  renderHeaderStrip,
  STRIP_HEIGHT_PX,
} from './squares'

/** Stack the header strip over the spectrogram region into one RGBA image. */
export function composeImage(headerBits: Uint8Array, region: PixelRegion): PixelRegion {
  const width = Math.max(region.width, MIN_STRIP_WIDTH)
  const height = STRIP_HEIGHT_PX + region.height
  const rgba = new Uint8ClampedArray(width * height * 4)

  // header strip (top rows), rendered at full image width
  const strip = renderHeaderStrip(headerBits, width)
  rgba.set(strip, 0)

  // spectrogram region below the header, left-aligned (remainder stays black/opaque)
  for (let i = STRIP_HEIGHT_PX * width * 4; i < rgba.length; i += 4) rgba[i + 3] = 255
  for (let ry = 0; ry < region.height; ry++) {
    for (let rx = 0; rx < region.width; rx++) {
      const src = (ry * region.width + rx) * 4
      const dst = ((ry + STRIP_HEIGHT_PX) * width + rx) * 4
      rgba[dst] = region.rgba[src]
      rgba[dst + 1] = region.rgba[src + 1]
      rgba[dst + 2] = region.rgba[src + 2]
      rgba[dst + 3] = 255
    }
  }
  return { width, height, rgba }
}

/** Read the 140-bit header from the top of a full image. */
export function readHeaderFromImage(rgba: Uint8ClampedArray, width: number): Uint8Array {
  return readHeaderStrip(rgba, width)
}

/** Extract the frames x bins spectrogram sub-region (below the header) as its own RGBA buffer. */
export function readRegionFromImage(
  rgba: Uint8ClampedArray,
  imageWidth: number,
  frames: number,
  bins: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(frames * bins * 4)
  for (let ry = 0; ry < bins; ry++) {
    for (let rx = 0; rx < frames; rx++) {
      const src = ((ry + STRIP_HEIGHT_PX) * imageWidth + rx) * 4
      const dst = (ry * frames + rx) * 4
      out[dst] = rgba[src]
      out[dst + 1] = rgba[src + 1]
      out[dst + 2] = rgba[src + 2]
      out[dst + 3] = rgba[src + 3]
    }
  }
  return out
}
