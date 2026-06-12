import { describe, expect, it } from 'vitest'
import {
  audioDecodeErrorMessage,
  capSamples,
  mixToMono,
  peakNormalize,
  resampleLinear,
  resampleSinc,
} from './decode'

/** Energy of `signal` at a single frequency (single-bin DFT magnitude). */
function bandEnergy(signal: Float32Array, rate: number, freq: number): number {
  let re = 0
  let im = 0
  for (let n = 0; n < signal.length; n++) {
    const phase = (2 * Math.PI * freq * n) / rate
    re += signal[n] * Math.cos(phase)
    im += signal[n] * Math.sin(phase)
  }
  return Math.hypot(re, im) / signal.length
}

describe('mixToMono', () => {
  it('returns a copy of a single channel', () => {
    const ch = Float32Array.from([0.1, -0.2, 0.3])
    const mono = mixToMono([ch])
    expect(Array.from(mono)).toEqual([
      Math.fround(0.1),
      Math.fround(-0.2),
      Math.fround(0.3),
    ])
    expect(mono).not.toBe(ch)
  })

  it('averages multiple channels', () => {
    const l = Float32Array.from([1, 0, -1])
    const r = Float32Array.from([0, 0, 1])
    expect(Array.from(mixToMono([l, r]))).toEqual([0.5, 0, 0])
  })
})

describe('peakNormalize', () => {
  it('scales the peak to 1.0', () => {
    const out = peakNormalize(Float32Array.from([0.5, -0.25]))
    expect(out[0]).toBeCloseTo(1.0, 6)
    expect(out[1]).toBeCloseTo(-0.5, 6)
  })

  it('leaves all-zero input unchanged (no divide by zero)', () => {
    expect(Array.from(peakNormalize(Float32Array.from([0, 0, 0])))).toEqual([0, 0, 0])
  })
})

describe('resampleLinear', () => {
  it('returns a copy when rates match', () => {
    const s = Float32Array.from([0, 1, 2, 3])
    const out = resampleLinear(s, 8000, 8000)
    expect(Array.from(out)).toEqual([0, 1, 2, 3])
    expect(out).not.toBe(s)
  })

  it('downsamples by an integer factor', () => {
    const out = resampleLinear(Float32Array.from([0, 1, 2, 3]), 4, 2)
    expect(Array.from(out)).toEqual([0, 2])
  })

  it('upsamples with linear interpolation and clamps the tail', () => {
    const out = resampleLinear(Float32Array.from([0, 1]), 1000, 2000)
    expect(out.length).toBe(4)
    expect(out[0]).toBeCloseTo(0, 6)
    expect(out[1]).toBeCloseTo(0.5, 6)
    expect(out[2]).toBeCloseTo(1, 6)
    expect(out[3]).toBeCloseTo(1, 6)
  })
})

describe('resampleSinc', () => {
  it('returns a copy when rates match', () => {
    const s = Float32Array.from([0, 1, 2, 3])
    const out = resampleSinc(s, 16000, 16000)
    expect(Array.from(out)).toEqual([0, 1, 2, 3])
    expect(out).not.toBe(s)
  })

  it('produces the expected output length', () => {
    const s = new Float32Array(4800)
    expect(resampleSinc(s, 48000, 16000).length).toBe(1600)
  })

  it('suppresses aliasing far better than linear interpolation', () => {
    // A 14 kHz tone is above the 8 kHz Nyquist of the 16 kHz target. Without an
    // anti-alias filter it folds down to |16000 - 14000| = 2000 Hz.
    const srcRate = 48000
    const dstRate = 16000
    const N = 4800 // 0.1 s
    const f0 = 14000
    const src = Float32Array.from({ length: N }, (_, i) =>
      Math.sin((2 * Math.PI * f0 * i) / srcRate),
    )
    const aliasFreq = 2000
    const eLinear = bandEnergy(resampleLinear(src, srcRate, dstRate), dstRate, aliasFreq)
    const eSinc = bandEnergy(resampleSinc(src, srcRate, dstRate), dstRate, aliasFreq)
    expect(eSinc).toBeLessThan(eLinear * 0.25)
  })

  it('preserves a passband tone', () => {
    const srcRate = 48000
    const dstRate = 16000
    const N = 4800
    const f0 = 1000 // well within the 8 kHz target Nyquist
    const src = Float32Array.from({ length: N }, (_, i) =>
      Math.sin((2 * Math.PI * f0 * i) / srcRate),
    )
    const out = resampleSinc(src, srcRate, dstRate)
    const inBand = bandEnergy(out, dstRate, f0)
    const offBand = bandEnergy(out, dstRate, 4000)
    expect(inBand).toBeGreaterThan(offBand * 10)
  })
})

describe('capSamples', () => {
  it('truncates audio longer than the cap', () => {
    const s = Float32Array.from({ length: 100 }, (_, i) => i)
    const { samples, capped } = capSamples(s, 10, 5) // 10Hz, 5s -> 50 samples
    expect(samples.length).toBe(50)
    expect(capped).toBe(true)
  })

  it('leaves shorter audio untouched', () => {
    const s = Float32Array.from({ length: 30 }, (_, i) => i)
    const { samples, capped } = capSamples(s, 10, 5)
    expect(samples.length).toBe(30)
    expect(capped).toBe(false)
  })
})

describe('audioDecodeErrorMessage', () => {
  it('returns a friendly, actionable message for any decode failure', () => {
    const msg = audioDecodeErrorMessage(new Error('EncodingError'))
    expect(msg).toMatch(/could not decode/i)
    expect(msg).toMatch(/MP3 or WAV/i)
    expect(msg).toMatch(/record/i)
  })
})
