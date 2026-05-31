import { describe, it, expect } from 'vitest'
import { packHeader, unpackHeader, HEADER_BITS } from './header'
import type { WavegramHeader } from '../params'
import { MAGIC } from '../params'

const sample: WavegramHeader = {
  version: 1,
  precision: 1,
  sampleRate: 16000,
  fftSize: 1024,
  hopSize: 512,
  sampleCount: 480000,
  channels: 1,
}

describe('packHeader / unpackHeader', () => {
  it('produces exactly 140 bits', () => {
    expect(HEADER_BITS).toBe(140)
    expect(packHeader(sample).length).toBe(140)
  })

  it('round-trips all fields', () => {
    const decoded = unpackHeader(packHeader(sample))
    expect(decoded.magicValid).toBe(true)
    expect(decoded.crcValid).toBe(true)
    expect(decoded.header).toEqual(sample)
  })

  it('round-trips the 8-bit precision variant', () => {
    const h = { ...sample, precision: 0 as const }
    const decoded = unpackHeader(packHeader(h))
    expect(decoded.header?.precision).toBe(0)
    expect(decoded.crcValid).toBe(true)
  })

  it('round-trips maximum field values', () => {
    const h: WavegramHeader = {
      version: 15,
      precision: 1,
      sampleRate: 0xffffff,
      fftSize: 1023,
      hopSize: 1023,
      sampleCount: 0xffffffff,
      channels: 255,
    }
    expect(unpackHeader(packHeader(h)).header).toEqual(h)
  })

  it('detects wrong magic bytes', () => {
    const bits = packHeader(sample)
    bits[0] ^= 1 // flip a magic bit
    const decoded = unpackHeader(bits)
    expect(decoded.magicValid).toBe(false)
  })

  it('detects CRC corruption in a payload field', () => {
    const bits = packHeader(sample)
    // flip a bit inside the sampleRate field (well past magic, before CRC)
    bits[45] ^= 1
    const decoded = unpackHeader(bits)
    expect(decoded.magicValid).toBe(true)
    expect(decoded.crcValid).toBe(false)
  })

  it('encodes the magic constant at the front', () => {
    const bits = packHeader(sample)
    let magic = 0
    for (let i = 0; i < 32; i++) magic = (magic * 2 + bits[i]) >>> 0
    expect(magic >>> 0).toBe(MAGIC >>> 0)
  })
})
