import { describe, expect, it } from 'vitest'
import type { WavegramHeader } from '../params'
import { MAGIC } from '../params'
import { HEADER_BITS, packHeader, unpackHeader } from './header'

const sample: WavegramHeader = {
  version: 2,
  precision: 1,
  hasPhase: false,
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
      hasPhase: true,
      sampleRate: 0xffffff,
      fftSize: 2048, // v3+ stores log2 (=11), which fits the 11-bit field; raw 2048 would not
      hopSize: 1023, // hopSize stays raw: exercise its 11-bit max
      sampleCount: 0xffffffff,
      channels: 255,
    }
    expect(unpackHeader(packHeader(h)).header).toEqual(h)
  })

  it('round-trips fftSize 2048 (v3 exponent encoding)', () => {
    const decoded = unpackHeader(packHeader({ ...sample, version: 3, fftSize: 2048 }))
    expect(decoded.crcValid).toBe(true)
    expect(decoded.header?.fftSize).toBe(2048)
  })

  it('decodes a legacy v2 image with a raw fftSize field', () => {
    const decoded = unpackHeader(packHeader({ ...sample, version: 2, fftSize: 1024 }))
    expect(decoded.crcValid).toBe(true)
    expect(decoded.header?.fftSize).toBe(1024)
  })

  it('throws rather than silently truncating an oversized field', () => {
    // channels is an 8-bit field; 256 does not fit. (The same guard catches the original
    // fftSize-2048-in-11-bits truncation that this fix is about.)
    expect(() => packHeader({ ...sample, channels: 256 })).toThrow(/does not fit/)
  })

  it('round-trips the hasPhase flag', () => {
    const withPhase = unpackHeader(packHeader({ ...sample, hasPhase: true }))
    expect(withPhase.header?.hasPhase).toBe(true)
    expect(withPhase.crcValid).toBe(true)
    const without = unpackHeader(packHeader({ ...sample, hasPhase: false }))
    expect(without.header?.hasPhase).toBe(false)
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
