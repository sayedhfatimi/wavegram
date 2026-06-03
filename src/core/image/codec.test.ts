import { describe, expect, it } from 'vitest'
import type { WavegramHeader } from '../params'
import { composeImage, readHeaderFromImage, readRegionFromImage } from './codec'
import { packHeader, unpackHeader } from './header'
import { packSpectrogram, unpackSpectrogram } from './spectrogram'
import { MIN_STRIP_WIDTH, STRIP_HEIGHT_PX } from './squares'

const header: WavegramHeader = {
  version: 2,
  precision: 1,
  hasPhase: false,
  sampleRate: 16000,
  fftSize: 8, // tiny: 5 bins
  hopSize: 4,
  sampleCount: 100,
  channels: 1,
}

function makeValues(frames: number, bins: number): Float32Array[] {
  const out: Float32Array[] = []
  for (let f = 0; f < frames; f++) {
    const a = new Float32Array(bins)
    for (let b = 0; b < bins; b++) a[b] = ((f * bins + b) % 50) / 50
    out.push(a)
  }
  return out
}

describe('composeImage', () => {
  it('stacks a 16px header over the spectrogram and pads to the min strip width', () => {
    const bins = 5
    const region = packSpectrogram(makeValues(10, bins), 1) // only 10 frames -> narrow
    const img = composeImage(packHeader(header), region)
    expect(img.width).toBe(MIN_STRIP_WIDTH) // padded up from 10
    expect(img.height).toBe(STRIP_HEIGHT_PX + bins)
  })

  it('keeps natural width when the spectrogram is wider than the minimum', () => {
    const bins = 5
    const region = packSpectrogram(makeValues(700, bins), 1)
    const img = composeImage(packHeader(header), region)
    expect(img.width).toBe(700)
  })
})

describe('compose -> extract round trip', () => {
  it('recovers the header and the spectrogram values', () => {
    const frames = 12
    const bins = 5
    const values = makeValues(frames, bins)
    const region = packSpectrogram(values, 1)
    const img = composeImage(packHeader(header), region)

    const headerBits = readHeaderFromImage(img.rgba, img.width)
    const decoded = unpackHeader(headerBits)
    expect(decoded.crcValid).toBe(true)
    expect(decoded.header).toEqual(header)

    const regionRgba = readRegionFromImage(img.rgba, img.width, frames, bins)
    const out = unpackSpectrogram(regionRgba, frames, bins, 1)
    for (let f = 0; f < frames; f++) {
      for (let b = 0; b < bins; b++) {
        expect(out[f][b]).toBeCloseTo(values[f][b], 4)
      }
    }
  })
})
