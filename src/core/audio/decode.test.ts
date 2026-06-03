import { describe, expect, it } from 'vitest'
import { capSamples, mixToMono, peakNormalize, resampleLinear } from './decode'

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
