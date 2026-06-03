import { describe, expect, it } from 'vitest'
import { magnitudeToFalseColorRegion } from './spectrogramView'

describe('magnitudeToFalseColorRegion', () => {
  it('produces one pixel per (frame, bin) with frequency low->high bottom-up', () => {
    // 1 frame, 2 bins: bin 0 (value 0) at the bottom, bin 1 (value 1) at the top.
    const region = magnitudeToFalseColorRegion([Float32Array.from([0, 1])])
    expect(region.width).toBe(1)
    expect(region.height).toBe(2)

    // top row (ry = 0) is bin 1 = viridis(1) = yellow
    expect([region.rgba[0], region.rgba[1], region.rgba[2], region.rgba[3]]).toEqual([
      253, 231, 37, 255,
    ])
    // bottom row (ry = 1) is bin 0 = viridis(0) = dark purple
    expect([region.rgba[4], region.rgba[5], region.rgba[6], region.rgba[7]]).toEqual([
      68, 1, 84, 255,
    ])
  })

  it('returns an empty region for empty input', () => {
    const region = magnitudeToFalseColorRegion([])
    expect(region.width).toBe(0)
    expect(region.height).toBe(0)
  })
})
