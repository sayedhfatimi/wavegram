import { describe, expect, it } from 'vitest'
import { FLOOR_DB, forwardLogScale, inverseLogScale } from './log'

describe('forwardLogScale', () => {
  it('maps the global maximum to 1.0 and stays within [0,1]', () => {
    const mag = [Float32Array.from([10, 1, 0.001])]
    const s = forwardLogScale(mag)
    expect(s[0][0]).toBeCloseTo(1, 6) // 10 is the max -> 0 dB -> 1
    for (const v of s[0]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('clamps magnitudes below the dB floor to 0', () => {
    // value 12 orders of magnitude below max is well past -80 dB
    const mag = [Float32Array.from([1, 1e-12])]
    const s = forwardLogScale(mag)
    expect(s[0][1]).toBe(0)
  })

  it('maps a -20 dB relative magnitude to the expected point', () => {
    const mag = [Float32Array.from([10, 1])] // 1/10 = -20 dB
    const s = forwardLogScale(mag)
    expect(s[0][1]).toBeCloseTo((-20 - FLOOR_DB) / -FLOOR_DB, 5) // 0.75 for -80 floor
  })

  it('handles an all-zero matrix without NaN', () => {
    const s = forwardLogScale([Float32Array.from([0, 0])])
    expect(s[0][0]).toBe(0)
    expect(s[0][1]).toBe(0)
  })
})

describe('forward/inverse round trip', () => {
  it('recovers magnitudes relative to the global max', () => {
    const mag = [Float32Array.from([10, 5, 1]), Float32Array.from([2, 0.1, 8])]
    const recovered = inverseLogScale(forwardLogScale(mag))
    const max = 10
    for (let f = 0; f < mag.length; f++) {
      for (let k = 0; k < mag[f].length; k++) {
        expect(recovered[f][k]).toBeCloseTo(mag[f][k] / max, 4)
      }
    }
  })
})
