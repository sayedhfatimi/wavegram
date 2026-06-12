// Guards the full audio -> image -> metadata -> magnitude path for EVERY FFT size the Forward
// tab offers. The original 2048 bug shipped because the round-trip tests only ever used 1024,
// which fits the raw 11-bit header field; 2048 overflowed to 0 and made reconstruction throw.

import { describe, expect, it } from 'vitest'
import { extractMagnitude, readMetadata } from './backward'
import { encodeToImage } from './forward'
import { freqBins } from './params'

// Must match src/ui/forward/ForwardTab.tsx FFT_OPTIONS.
const FFT_OPTIONS = [256, 512, 1024, 2048]
const sampleRate = 16000
const N = 8192 // long enough to yield several frames even at fftSize 2048

const sig = Float32Array.from({ length: N }, (_, i) => {
  const t = i / sampleRate
  return 0.6 * Math.sin(2 * Math.PI * 220 * t) + 0.4 * Math.sin(2 * Math.PI * 440 * t)
})

describe('every FFT option round-trips through the header and reconstruction setup', () => {
  for (const fftSize of FFT_OPTIONS) {
    const hop = fftSize / 2

    it(`fftSize ${fftSize}: header preserves params and magnitude extracts`, () => {
      const img = encodeToImage(sig, sampleRate, N, fftSize, hop, 1)
      expect(img.height).toBe(16 + freqBins(fftSize))

      const meta = readMetadata(img.rgba, img.width)
      expect(meta.magicValid).toBe(true)
      expect(meta.crcValid).toBe(true)
      expect(meta.header?.fftSize).toBe(fftSize)
      expect(meta.header?.hopSize).toBe(hop)

      // This is what the Reconstruct button calls; it threw for fftSize 2048 before the fix.
      const mag = extractMagnitude(img.rgba, img.width, img.height, meta.header!)
      expect(mag.length).toBeGreaterThan(0)
      expect(mag[0].length).toBe(freqBins(fftSize))
    })
  }
})
