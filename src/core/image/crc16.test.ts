import { describe, it, expect } from 'vitest'
import { crc16, bytesToBits } from './crc16'

describe('crc16 (CCITT-FALSE)', () => {
  it('matches the canonical "123456789" check value 0x29B1', () => {
    const bits = bytesToBits(new TextEncoder().encode('123456789'))
    expect(crc16(bits)).toBe(0x29b1)
  })

  it('returns the init value 0xFFFF for empty input', () => {
    expect(crc16(new Uint8Array(0))).toBe(0xffff)
  })

  it('changes when a single bit flips', () => {
    const a = bytesToBits(new Uint8Array([0b10110010]))
    const b = bytesToBits(new Uint8Array([0b10110011]))
    expect(crc16(a)).not.toBe(crc16(b))
  })

  it('operates over non-byte-aligned bit lengths', () => {
    // 12 bits — no throw, deterministic
    const bits = Uint8Array.from([1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0])
    expect(crc16(bits)).toBe(crc16(bits))
    expect(crc16(bits)).toBeGreaterThanOrEqual(0)
    expect(crc16(bits)).toBeLessThanOrEqual(0xffff)
  })
})

describe('bytesToBits', () => {
  it('expands bytes MSB-first', () => {
    expect(Array.from(bytesToBits(new Uint8Array([0xa5])))).toEqual([
      1, 0, 1, 0, 0, 1, 0, 1,
    ])
  })
})
