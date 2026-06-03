import { describe, expect, it } from 'vitest'
import { viridis } from './colormap'

describe('viridis', () => {
  it('maps 0 to the dark-purple low end', () => {
    expect(viridis(0)).toEqual([68, 1, 84])
  })

  it('maps 1 to the yellow high end', () => {
    expect(viridis(1)).toEqual([253, 231, 37])
  })

  it('maps the midpoint to teal-green', () => {
    expect(viridis(0.5)).toEqual([33, 145, 140])
  })

  it('clamps out-of-range input', () => {
    expect(viridis(-1)).toEqual(viridis(0))
    expect(viridis(5)).toEqual(viridis(1))
  })

  it('keeps every channel within [0,255]', () => {
    for (let i = 0; i <= 20; i++) {
      const [r, g, b] = viridis(i / 20)
      for (const c of [r, g, b]) {
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(255)
      }
    }
  })
})
