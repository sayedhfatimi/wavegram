import { describe, it, expect } from 'vitest'
import { encodeToImage } from './forward'
import { readMetadata, extractMagnitude } from './backward'
import { griffinLim } from './audio/griffinlim'
import { stftMagnitude } from './audio/stft'

const sampleRate = 16000
const fftSize = 1024
const hop = 512
const N = 8192 // ~0.5s

// a synthetic voiced-ish signal: two harmonics with slow amplitude modulation
const sig = Float32Array.from({ length: N }, (_, i) => {
  const t = i / sampleRate
  const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)
  return am * (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 440 * t))
})

/** normalize a spectrogram by its global max, then relative L2 magnitude error */
function spectralError(a: Float32Array[], b: Float32Array[]): number {
  const norm = (m: Float32Array[]) => {
    let max = 0
    for (const f of m) for (const v of f) if (v > max) max = v
    const inv = max > 0 ? 1 / max : 0
    return m.map((f) => f.map((v) => v * inv) as unknown as Float32Array)
  }
  const na = norm(a)
  const nb = norm(b)
  let num = 0
  let den = 0
  const frames = Math.min(na.length, nb.length)
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < na[f].length; k++) {
      const d = nb[f][k] - na[f][k]
      num += d * d
      den += na[f][k] * na[f][k]
    }
  }
  return Math.sqrt(num / den)
}

describe('full audio -> image -> audio round trip', () => {
  const target = stftMagnitude(sig, fftSize, hop)

  it('encodes valid, self-describing metadata (16-bit)', () => {
    const img = encodeToImage(sig, sampleRate, N, fftSize, hop, 1)
    expect(img.height).toBe(16 + (fftSize / 2 + 1))
    const meta = readMetadata(img.rgba, img.width)
    expect(meta.magicValid).toBe(true)
    expect(meta.crcValid).toBe(true)
    expect(meta.header).toMatchObject({ sampleRate, fftSize, hopSize: hop, sampleCount: N, precision: 1 })
  })

  it('reconstructs an accurate spectrogram (16-bit, low spectral error)', () => {
    const img = encodeToImage(sig, sampleRate, N, fftSize, hop, 1)
    const meta = readMetadata(img.rgba, img.width)
    const mag = extractMagnitude(img.rgba, img.width, img.height, meta.header!)
    const recon = griffinLim(mag, fftSize, hop, 60, N)
    const err = spectralError(target, stftMagnitude(recon, fftSize, hop))
    expect(err).toBeLessThan(0.15)
  })

  it('16-bit precision reconstructs at least as accurately as 8-bit', () => {
    const run = (precision: 0 | 1) => {
      const img = encodeToImage(sig, sampleRate, N, fftSize, hop, precision)
      const meta = readMetadata(img.rgba, img.width)
      const mag = extractMagnitude(img.rgba, img.width, img.height, meta.header!)
      const recon = griffinLim(mag, fftSize, hop, 40, N)
      return spectralError(target, stftMagnitude(recon, fftSize, hop))
    }
    const err16 = run(1)
    const err8 = run(0)
    expect(err16).toBeLessThanOrEqual(err8 + 1e-6)
  })
})
