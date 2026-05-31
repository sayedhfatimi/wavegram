import { describe, it, expect } from 'vitest'
import { hannWindow, numFrames, stft, stftMagnitude } from './stft'

describe('hannWindow', () => {
  it('is the right length and starts at zero (periodic Hann)', () => {
    const w = hannWindow(8)
    expect(w.length).toBe(8)
    expect(w[0]).toBeCloseTo(0, 6)
  })

  it('peaks at the center', () => {
    const w = hannWindow(8)
    expect(w[4]).toBeCloseTo(1, 6)
  })

  it('satisfies COLA at 50% overlap (shifted windows sum to a constant)', () => {
    const size = 16
    const hop = 8
    const w = hannWindow(size)
    // periodic Hann: w[n] + w[n + N/2] == 1 for every n in the overlap region
    for (let n = 0; n < hop; n++) {
      expect(w[n] + w[n + hop]).toBeCloseTo(1, 6)
    }
  })
})

describe('numFrames', () => {
  it('returns 1 when the signal is shorter than the window', () => {
    expect(numFrames(100, 256, 128)).toBe(1)
  })
  it('covers the tail with a final padded frame', () => {
    // len 512, fft 256, hop 128 -> 1 + ceil((512-256)/128) = 1 + 2 = 3
    expect(numFrames(512, 256, 128)).toBe(3)
  })
})

describe('stft', () => {
  it('produces frames x bins where bins = fft/2 + 1', () => {
    const sig = new Float32Array(1024)
    const { real, imag, frames, bins } = stft(sig, 256, 128)
    expect(bins).toBe(129)
    expect(frames).toBe(real.length)
    expect(real.length).toBe(imag.length)
    expect(real[0].length).toBe(129)
  })

  it('magnitude equals hypot(real, imag) and is non-negative', () => {
    const sig = Float32Array.from({ length: 512 }, (_, i) => Math.sin((2 * Math.PI * 5 * i) / 512))
    const { real, imag } = stft(sig, 256, 128)
    const mag = stftMagnitude(sig, 256, 128)
    for (let f = 0; f < real.length; f++) {
      for (let k = 0; k < real[f].length; k++) {
        expect(mag[f][k]).toBeCloseTo(Math.hypot(real[f][k], imag[f][k]), 4)
        expect(mag[f][k]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('concentrates energy at the bin of a pure tone', () => {
    const fftSize = 256
    const k0 = 20 // cycles per window
    const sig = Float32Array.from({ length: 1024 }, (_, i) =>
      Math.cos((2 * Math.PI * k0 * i) / fftSize),
    )
    const mag = stftMagnitude(sig, fftSize, 128)
    const mid = mag[Math.floor(mag.length / 2)]
    let peakBin = 0
    for (let k = 1; k < mid.length; k++) if (mid[k] > mid[peakBin]) peakBin = k
    expect(peakBin).toBe(k0)
  })
})
