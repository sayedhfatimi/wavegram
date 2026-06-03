// Renders the 140-bit header as a strip of 8x8px black/white squares and reads it back.
//
// Layout: a 16px-tall strip = two rows of 8x8 squares. 140 bits = 70 columns x 2 rows.
// Bits fill row-major: bits 0..69 across the top row, bits 70..139 across the bottom row.
// White square = bit 1, black square = bit 0. Strips wider than the squares are white-padded
// (the reader only samples the 70 square centers per row). The strip spans the full image width
// so it lines up with the spectrogram below it.

import { HEADER_BITS } from './header'

export const SQUARE_PX = 8
export const STRIP_HEIGHT_PX = 16
export const BITS_PER_ROW = HEADER_BITS / 2 // 70
export const MIN_STRIP_WIDTH = BITS_PER_ROW * SQUARE_PX // 560

function setPixel(
  rgba: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  v: number,
) {
  const i = (y * width + x) * 4
  rgba[i] = v
  rgba[i + 1] = v
  rgba[i + 2] = v
  rgba[i + 3] = 255
}

/** Render the 140-bit header to RGBA pixels for a `width` x 16 strip. */
export function renderHeaderStrip(bits: Uint8Array, width: number): Uint8ClampedArray {
  if (bits.length !== HEADER_BITS) {
    throw new Error(`expected ${HEADER_BITS} header bits, got ${bits.length}`)
  }
  if (width < MIN_STRIP_WIDTH) {
    throw new Error(`strip width ${width} below minimum ${MIN_STRIP_WIDTH}`)
  }

  const rgba = new Uint8ClampedArray(width * STRIP_HEIGHT_PX * 4)
  rgba.fill(255) // white background, opaque alpha

  for (let bit = 0; bit < HEADER_BITS; bit++) {
    const row = Math.floor(bit / BITS_PER_ROW) // 0 = top, 1 = bottom
    const col = bit % BITS_PER_ROW
    const value = bits[bit] ? 255 : 0
    const x0 = col * SQUARE_PX
    const y0 = row * SQUARE_PX
    for (let dy = 0; dy < SQUARE_PX; dy++) {
      for (let dx = 0; dx < SQUARE_PX; dx++) {
        setPixel(rgba, width, x0 + dx, y0 + dy, value)
      }
    }
  }
  return rgba
}

/** Read the 140-bit header from RGBA pixels by sampling each square's center. */
export function readHeaderStrip(rgba: Uint8ClampedArray, width: number): Uint8Array {
  const bits = new Uint8Array(HEADER_BITS)
  const c = SQUARE_PX / 2 // center offset
  for (let bit = 0; bit < HEADER_BITS; bit++) {
    const row = Math.floor(bit / BITS_PER_ROW)
    const col = bit % BITS_PER_ROW
    const x = col * SQUARE_PX + c
    const y = row * SQUARE_PX + c
    const i = (y * width + x) * 4
    // grayscale luminance threshold at mid-point
    bits[bit] = rgba[i] >= 128 ? 1 : 0
  }
  return bits
}
