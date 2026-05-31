import { describe, it, expect } from 'vitest'
import { encodeWav } from './wav'

function ascii(view: DataView, offset: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i))
  return s
}

describe('encodeWav', () => {
  const samples = Float32Array.from([0, 0.5, -0.5, 1])
  const wav = encodeWav(samples, 16000)
  const view = new DataView(wav)

  it('emits a 44-byte header + 16-bit mono PCM payload', () => {
    expect(wav.byteLength).toBe(44 + samples.length * 2)
  })

  it('has RIFF/WAVE/fmt/data chunk tags', () => {
    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(ascii(view, 12, 4)).toBe('fmt ')
    expect(ascii(view, 36, 4)).toBe('data')
  })

  it('records PCM format, mono, 16-bit, and the sample rate', () => {
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000) // sample rate
    expect(view.getUint16(34, true)).toBe(16) // bit depth
  })

  it('quantises full-scale samples correctly', () => {
    // sample value 1.0 -> 0x7FFF (32767)
    expect(view.getInt16(44 + 3 * 2, true)).toBe(32767)
  })
})
