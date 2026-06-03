// End-to-end integration through a REAL PNG codec (pngjs), not the in-memory RGBA shortcut the
// other round-trip test uses. This proves the core premise of the format: a standard lossless
// PNG encode/decode preserves the 16-bit RGB-packed magnitudes and the B&W header squares
// exactly, so the self-describing image survives being written to and read from a real .png file.

import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { griffinLim } from './audio/griffinlim'
import { stftMagnitude } from './audio/stft'
import { extractMagnitude, readMetadata } from './backward'
import { encodeToImage } from './forward'
import { assertPng, detectImageFormat } from './image/png'

const sampleRate = 16000
const fftSize = 1024
const hop = 512
const N = 8192

const sig = Float32Array.from({ length: N }, (_, i) => {
  const t = i / sampleRate
  const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)
  return am * (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 440 * t))
})

/** Encode a core PixelRegion to real PNG bytes via pngjs. */
function regionToPngBytes(region: {
  width: number
  height: number
  rgba: Uint8ClampedArray
}): Uint8Array {
  const png = new PNG({ width: region.width, height: region.height })
  png.data = Buffer.from(
    region.rgba.buffer,
    region.rgba.byteOffset,
    region.rgba.byteLength,
  )
  return new Uint8Array(PNG.sync.write(png))
}

/** Decode real PNG bytes back to an RGBA region via pngjs. */
function pngBytesToRegion(bytes: Uint8Array) {
  const png = PNG.sync.read(Buffer.from(bytes))
  return {
    width: png.width,
    height: png.height,
    rgba: new Uint8ClampedArray(
      png.data.buffer,
      png.data.byteOffset,
      png.data.byteLength,
    ),
  }
}

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

describe('real PNG codec round trip (16-bit)', () => {
  const region = encodeToImage(sig, sampleRate, N, fftSize, hop, 1)
  const pngBytes = regionToPngBytes(region)

  it('produces bytes recognised as PNG and accepted by the decoder guard', () => {
    expect(detectImageFormat(pngBytes)).toBe('png')
    expect(() => assertPng(pngBytes)).not.toThrow()
  })

  it('preserves the header (magic + CRC valid) through a real PNG encode/decode', () => {
    const back = pngBytesToRegion(pngBytes)
    const meta = readMetadata(back.rgba, back.width)
    expect(meta.magicValid).toBe(true)
    expect(meta.crcValid).toBe(true)
    expect(meta.header).toMatchObject({
      sampleRate,
      fftSize,
      hopSize: hop,
      sampleCount: N,
      precision: 1,
    })
  })

  it('reconstructs accurate audio after a real PNG file round trip', () => {
    const back = pngBytesToRegion(pngBytes)
    const meta = readMetadata(back.rgba, back.width)
    const mag = extractMagnitude(back.rgba, back.width, back.height, meta.header!)
    const recon = griffinLim(mag, fftSize, hop, 60, N)
    const err = spectralError(
      stftMagnitude(sig, fftSize, hop),
      stftMagnitude(recon, fftSize, hop),
    )
    expect(err).toBeLessThan(0.15)
  })
})
