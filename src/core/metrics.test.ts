import { describe, expect, it } from 'vitest'
import { spectralError } from './metrics'

describe('spectralError', () => {
  it('is 0 for identical spectrograms', () => {
    const m = [Float32Array.from([1, 0.5, 0.25]), Float32Array.from([0.1, 0.2, 0.3])]
    expect(spectralError(m, m)).toBeCloseTo(0, 6)
  })

  it('is scale-invariant (each input normalized by its own max)', () => {
    const target = [Float32Array.from([1, 2, 4])]
    const scaled = [Float32Array.from([2, 4, 8])] // 2x the target
    expect(spectralError(target, scaled)).toBeCloseTo(0, 6)
  })

  it('computes the normalized L2 difference', () => {
    // both already have max 1, so normalization is a no-op:
    // num = (1-1)^2 + (1-0)^2 = 1, den = 1^2 + 0^2 = 1 -> sqrt(1) = 1
    const target = [Float32Array.from([1, 0])]
    const actual = [Float32Array.from([1, 1])]
    expect(spectralError(target, actual)).toBeCloseTo(1, 6)
  })

  it('compares over the overlapping frames when lengths differ', () => {
    // actual has an extra frame; its values stay <= the global max (1) so
    // normalization matches the target and the overlapping frame is identical.
    const target = [Float32Array.from([1, 0])]
    const actual = [Float32Array.from([1, 0]), Float32Array.from([0.5, 0.5])]
    expect(spectralError(target, actual)).toBeCloseTo(0, 6)
  })
})
