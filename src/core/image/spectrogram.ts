// Pack/unpack the stored [0,1] spectrogram values into the pixel region.
//
// Region geometry: width = number of frames (time, left->right), height = number of bins.
// Frequency is oriented low->high from the BOTTOM up, so bin 0 (DC) is the bottom row.
//
// Precision 1 (16-bit): value -> R = high byte, G = low byte, B = phase (or 0).
// Precision 0 (8-bit):  value -> R = G = B = byte.
//
// Optional phase storage (16-bit only): the otherwise-unused B channel holds an 8-bit
// quantized phase in [-PI, PI]. Alpha stays 255 so canvas premultiplication never
// disturbs the colour channels.

import type { Precision } from '../params'

export interface PixelRegion {
  width: number
  height: number
  rgba: Uint8ClampedArray
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Quantize a phase in [-PI, PI] to a 0..255 byte. */
function phaseToByte(phase: number): number {
  const t = (phase + Math.PI) / (2 * Math.PI)
  return Math.max(0, Math.min(255, Math.round(t * 255)))
}

/** Recover a phase in [-PI, PI] from a 0..255 byte. */
function byteToPhase(byte: number): number {
  return (byte / 255) * 2 * Math.PI - Math.PI
}

/**
 * Pack values[frame][bin] (each in [0,1]) into an RGBA pixel region. When `phase`
 * is given (16-bit precision only), each bin's phase is quantized into the B channel.
 */
export function packSpectrogram(
  values: Float32Array[],
  precision: Precision,
  phase?: Float32Array[],
): PixelRegion {
  const width = values.length
  const height = width > 0 ? values[0].length : 0
  const rgba = new Uint8ClampedArray(width * height * 4)
  const storePhase = precision === 1 && !!phase

  for (let f = 0; f < width; f++) {
    const frame = values[f]
    const phaseFrame = storePhase ? phase[f] : undefined
    for (let bin = 0; bin < height; bin++) {
      const ry = height - 1 - bin // bin 0 at the bottom
      const i = (ry * width + f) * 4
      const v = clamp01(frame[bin])
      if (precision === 1) {
        const u = Math.round(v * 65535)
        rgba[i] = (u >> 8) & 0xff
        rgba[i + 1] = u & 0xff
        rgba[i + 2] = phaseFrame ? phaseToByte(phaseFrame[bin]) : 0
      } else {
        const g = Math.round(v * 255)
        rgba[i] = g
        rgba[i + 1] = g
        rgba[i + 2] = g
      }
      rgba[i + 3] = 255
    }
  }
  return { width, height, rgba }
}

/** Read an RGBA pixel region back into values[frame][bin] (each in [0,1]). */
export function unpackSpectrogram(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  precision: Precision,
): Float32Array[] {
  const values: Float32Array[] = []
  for (let f = 0; f < width; f++) {
    const frame = new Float32Array(height)
    for (let bin = 0; bin < height; bin++) {
      const ry = height - 1 - bin
      const i = (ry * width + f) * 4
      frame[bin] =
        precision === 1 ? ((rgba[i] << 8) | rgba[i + 1]) / 65535 : rgba[i] / 255
    }
    values.push(frame)
  }
  return values
}

/** Read per-bin phase (radians, [-PI, PI]) from the B channel of a 16-bit region. */
export function unpackPhase(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array[] {
  const phase: Float32Array[] = []
  for (let f = 0; f < width; f++) {
    const frame = new Float32Array(height)
    for (let bin = 0; bin < height; bin++) {
      const ry = height - 1 - bin
      const i = (ry * width + f) * 4
      frame[bin] = byteToPhase(rgba[i + 2])
    }
    phase.push(frame)
  }
  return phase
}
