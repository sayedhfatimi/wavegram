import { describe, expect, it } from 'vitest'
import { istft } from './istft'
import { stft } from './stft'

function rmse(a: Float32Array, b: Float32Array, from: number, to: number): number {
  let sum = 0
  let n = 0
  for (let i = from; i < to; i++) {
    const d = a[i] - b[i]
    sum += d * d
    n++
  }
  return Math.sqrt(sum / n)
}

describe('istft (round trip with true phase)', () => {
  it('reconstructs a sine wave interior to high accuracy', () => {
    const N = 2048
    const fftSize = 256
    const hop = 128
    const sig = Float32Array.from({ length: N }, (_, i) =>
      Math.sin((2 * Math.PI * 7 * i) / fftSize),
    )
    const { real, imag } = stft(sig, fftSize, hop)
    const out = istft(real, imag, fftSize, hop, N)
    expect(out.length).toBe(N)
    // interior (skip one window at each edge where Hann tapers to 0)
    expect(rmse(out, sig, fftSize, N - fftSize)).toBeLessThan(1e-4)
  })

  it('reconstructs a constant (DC) signal interior', () => {
    const N = 1024
    const fftSize = 256
    const hop = 128
    const sig = new Float32Array(N).fill(0.5)
    const { real, imag } = stft(sig, fftSize, hop)
    const out = istft(real, imag, fftSize, hop, N)
    expect(rmse(out, sig, fftSize, N - fftSize)).toBeLessThan(1e-4)
  })

  it('trims output to the requested length', () => {
    const sig = new Float32Array(700)
    const { real, imag } = stft(sig, 256, 128)
    expect(istft(real, imag, 256, 128, 700).length).toBe(700)
  })
})
