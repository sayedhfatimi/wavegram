import { describe, expect, it } from 'vitest'
import { assertPng, detectImageFormat } from './png'

const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPEG_SIG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
const WEBP_SIG = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
])
const GIF_SIG = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

describe('detectImageFormat', () => {
  it('recognises PNG', () => {
    expect(detectImageFormat(PNG_SIG)).toBe('png')
  })
  it('recognises JPEG', () => {
    expect(detectImageFormat(JPEG_SIG)).toBe('jpeg')
  })
  it('recognises WebP', () => {
    expect(detectImageFormat(WEBP_SIG)).toBe('webp')
  })
  it('returns unknown for unrecognised data', () => {
    expect(detectImageFormat(GIF_SIG)).toBe('unknown')
  })
})

describe('assertPng', () => {
  it('passes for PNG data', () => {
    expect(() => assertPng(PNG_SIG)).not.toThrow()
  })
  it('rejects JPEG with a lossy-format message', () => {
    expect(() => assertPng(JPEG_SIG)).toThrow(/png/i)
  })
  it('rejects WebP', () => {
    expect(() => assertPng(WEBP_SIG)).toThrow(/png/i)
  })
})
