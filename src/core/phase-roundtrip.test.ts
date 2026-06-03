import { describe, expect, it } from 'vitest'
import { griffinLim } from './audio/griffinlim'
import { stftMagnitude } from './audio/stft'
import { extractMagnitude, extractPhase, readMetadata } from './backward'
import { encodeToImage } from './forward'
import { spectralError } from './metrics'

const sampleRate = 16000
const fftSize = 256
const hop = 64
const N = 4096
// two-tone signal so the recovered phase actually carries information
const signal = Float32Array.from(
  { length: N },
  (_, i) =>
    0.6 * Math.sin((2 * Math.PI * 7 * i) / fftSize) +
    0.4 * Math.sin((2 * Math.PI * 19 * i) / fftSize + 1.1),
)

describe('phase-seeded round trip (format v2)', () => {
  it('stores phase and seeds a much better low-iteration reconstruction', () => {
    const region = encodeToImage(signal, sampleRate, N, fftSize, hop, 1, true)
    const meta = readMetadata(region.rgba, region.width)
    expect(meta.crcValid).toBe(true)
    expect(meta.header?.hasPhase).toBe(true)

    const header = meta.header
    if (!header) throw new Error('no header')
    const magnitude = extractMagnitude(region.rgba, region.width, region.height, header)
    const phase = extractPhase(region.rgba, region.width, region.height, header)
    expect(phase).not.toBeNull()

    const iters = 2
    const seeded = griffinLim(
      magnitude,
      fftSize,
      hop,
      iters,
      N,
      undefined,
      0,
      phase ?? undefined,
    )
    const unseeded = griffinLim(magnitude, fftSize, hop, iters, N)
    const target = stftMagnitude(signal, fftSize, hop)
    const errSeeded = spectralError(target, stftMagnitude(seeded, fftSize, hop))
    const errUnseeded = spectralError(target, stftMagnitude(unseeded, fftSize, hop))
    expect(errSeeded).toBeLessThan(errUnseeded)
  })

  it('omits phase for 8-bit precision and still decodes', () => {
    const region = encodeToImage(signal, sampleRate, N, fftSize, hop, 0, true)
    const meta = readMetadata(region.rgba, region.width)
    expect(meta.header?.hasPhase).toBe(false)
    expect(
      extractPhase(region.rgba, region.width, region.height, meta.header!),
    ).toBeNull()
  })

  it('decodes a no-phase (v1-style) image with hasPhase false', () => {
    const region = encodeToImage(signal, sampleRate, N, fftSize, hop, 1, false)
    const meta = readMetadata(region.rgba, region.width)
    expect(meta.crcValid).toBe(true)
    expect(meta.header?.hasPhase).toBe(false)
    expect(
      extractPhase(region.rgba, region.width, region.height, meta.header!),
    ).toBeNull()
  })
})
