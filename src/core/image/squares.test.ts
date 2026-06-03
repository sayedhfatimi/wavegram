import { describe, expect, it } from 'vitest'
import type { WavegramHeader } from '../params'
import { packHeader, unpackHeader } from './header'
import {
  MIN_STRIP_WIDTH,
  readHeaderStrip,
  renderHeaderStrip,
  SQUARE_PX,
  STRIP_HEIGHT_PX,
} from './squares'

function randomBits(n: number, seed: number): Uint8Array {
  // deterministic LCG so the test is stable without Math.random
  const bits = new Uint8Array(n)
  let s = seed >>> 0
  for (let i = 0; i < n; i++) {
    s = (1103515245 * s + 12345) >>> 0
    bits[i] = (s >>> 16) & 1
  }
  return bits
}

const sample: WavegramHeader = {
  version: 1,
  precision: 1,
  sampleRate: 16000,
  fftSize: 1024,
  hopSize: 512,
  sampleCount: 480000,
  channels: 1,
}

describe('header strip geometry', () => {
  it('uses 8px squares, a 16px-tall strip, and ≥560px width', () => {
    expect(SQUARE_PX).toBe(8)
    expect(STRIP_HEIGHT_PX).toBe(16)
    expect(MIN_STRIP_WIDTH).toBe(560)
  })
})

describe('renderHeaderStrip / readHeaderStrip', () => {
  it('round-trips a packed header at minimum width', () => {
    const bits = packHeader(sample)
    const rgba = renderHeaderStrip(bits, MIN_STRIP_WIDTH)
    expect(rgba.length).toBe(MIN_STRIP_WIDTH * STRIP_HEIGHT_PX * 4)
    const read = readHeaderStrip(rgba, MIN_STRIP_WIDTH)
    expect(Array.from(read)).toEqual(Array.from(bits))
    expect(unpackHeader(read).crcValid).toBe(true)
  })

  it('round-trips when the strip is padded wider than the squares', () => {
    const bits = packHeader(sample)
    const wide = 1875
    const rgba = renderHeaderStrip(bits, wide)
    const read = readHeaderStrip(rgba, wide)
    expect(Array.from(read)).toEqual(Array.from(bits))
  })

  it('round-trips arbitrary bit patterns', () => {
    const bits = randomBits(140, 7)
    const rgba = renderHeaderStrip(bits, MIN_STRIP_WIDTH)
    expect(Array.from(readHeaderStrip(rgba, MIN_STRIP_WIDTH))).toEqual(Array.from(bits))
  })

  it('renders a 1 bit as white and a 0 bit as black at the first square center', () => {
    const ones = renderHeaderStrip(Uint8Array.from(Array(140).fill(1)), MIN_STRIP_WIDTH)
    const zeros = renderHeaderStrip(Uint8Array.from(Array(140).fill(0)), MIN_STRIP_WIDTH)
    // center of first square: x=4, y=4
    const idx = (4 * MIN_STRIP_WIDTH + 4) * 4
    expect(ones[idx]).toBe(255)
    expect(zeros[idx]).toBe(0)
  })

  it('throws if width is below the minimum strip width', () => {
    expect(() => renderHeaderStrip(packHeader(sample), 400)).toThrow()
  })
})
