import { describe, it, expect } from 'vitest'
import { packSpectrogram, unpackSpectrogram } from './spectrogram'

// values[frame][bin], all frames have the same bin count
const values = [
  Float32Array.from([0, 0.25, 0.5, 1]),
  Float32Array.from([1, 0.75, 0.5, 0]),
  Float32Array.from([0.1, 0.2, 0.3, 0.4]),
]

describe('packSpectrogram dimensions', () => {
  it('produces width = frames, height = bins, RGBA buffer', () => {
    const { width, height, rgba } = packSpectrogram(values, 1)
    expect(width).toBe(3)
    expect(height).toBe(4)
    expect(rgba.length).toBe(3 * 4 * 4)
  })
})

describe('16-bit RGB precision', () => {
  it('round-trips to ~1/65535', () => {
    const { width, height, rgba } = packSpectrogram(values, 1)
    const out = unpackSpectrogram(rgba, width, height, 1)
    for (let f = 0; f < values.length; f++) {
      for (let k = 0; k < values[f].length; k++) {
        expect(out[f][k]).toBeCloseTo(values[f][k], 4)
      }
    }
  })

  it('packs value into R(high)/G(low), B=0', () => {
    const { rgba, width, height } = packSpectrogram([Float32Array.from([1])], 1)
    // single pixel: bin 0 sits at the bottom row (height-1)
    const idx = ((height - 1) * width + 0) * 4
    expect(rgba[idx]).toBe(255) // R high byte
    expect(rgba[idx + 1]).toBe(255) // G low byte
    expect(rgba[idx + 2]).toBe(0) // B unused
    expect(rgba[idx + 3]).toBe(255) // A
  })
})

describe('8-bit grayscale precision', () => {
  it('round-trips to ~1/255 and is gray (R=G=B)', () => {
    const { width, height, rgba } = packSpectrogram(values, 0)
    const out = unpackSpectrogram(rgba, width, height, 0)
    const idx = 0
    expect(rgba[idx]).toBe(rgba[idx + 1])
    expect(rgba[idx + 1]).toBe(rgba[idx + 2])
    for (let f = 0; f < values.length; f++) {
      for (let k = 0; k < values[f].length; k++) {
        expect(out[f][k]).toBeCloseTo(values[f][k], 2)
      }
    }
  })
})

describe('frequency orientation', () => {
  it('places bin 0 (low freq) at the bottom row', () => {
    const v = [Float32Array.from([0.2, 0.9])] // bin0=0.2, bin1=0.9
    const { rgba, width, height } = packSpectrogram(v, 1)
    const bottom = ((height - 1) * width + 0) * 4 // bin 0
    const top = (0 * width + 0) * 4 // bin 1
    const bottomVal = ((rgba[bottom] << 8) | rgba[bottom + 1]) / 65535
    const topVal = ((rgba[top] << 8) | rgba[top + 1]) / 65535
    expect(bottomVal).toBeCloseTo(0.2, 3)
    expect(topVal).toBeCloseTo(0.9, 3)
  })
})
