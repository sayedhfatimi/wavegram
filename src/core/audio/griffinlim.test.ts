import { describe, expect, it } from 'vitest'
import { griffinLim } from './griffinlim'
import { stft, stftMagnitude } from './stft'

/** Spectral convergence: relative magnitude error between two spectrograms. */
function spectralError(target: Float32Array[], recon: Float32Array[]): number {
  let num = 0
  let den = 0
  const frames = Math.min(target.length, recon.length)
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < target[f].length; k++) {
      const d = recon[f][k] - target[f][k]
      num += d * d
      den += target[f][k] * target[f][k]
    }
  }
  return Math.sqrt(num / den)
}

const fftSize = 256
const hop = 64
const N = 4096
const sine = Float32Array.from({ length: N }, (_, i) =>
  Math.sin((2 * Math.PI * 9 * i) / fftSize),
)
const target = stftMagnitude(sine, fftSize, hop)

describe('griffinLim', () => {
  it('returns a signal of the requested length', () => {
    const out = griffinLim(target, fftSize, hop, 10, N)
    expect(out.length).toBe(N)
  })

  it('converges: more iterations lower the spectral error', () => {
    const few = griffinLim(target, fftSize, hop, 1, N)
    const many = griffinLim(target, fftSize, hop, 60, N)
    const errFew = spectralError(target, stftMagnitude(few, fftSize, hop))
    const errMany = spectralError(target, stftMagnitude(many, fftSize, hop))
    expect(errMany).toBeLessThan(errFew)
    expect(errMany).toBeLessThan(0.1)
  })

  it('recovers the dominant frequency bin of a pure tone', () => {
    const out = griffinLim(target, fftSize, hop, 50, N)
    const mag = stftMagnitude(out, fftSize, hop)
    const mid = mag[Math.floor(mag.length / 2)]
    let peak = 0
    for (let k = 1; k < mid.length; k++) if (mid[k] > mid[peak]) peak = k
    expect(peak).toBe(9)
  })

  it('reports progress ending at the final iteration', () => {
    const seen: number[] = []
    griffinLim(target, fftSize, hop, 5, N, (done, total) => seen.push(done / total))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1]).toBeCloseTo(1, 6)
  })

  it('momentum of 0 reproduces vanilla Griffin-Lim', () => {
    const vanilla = griffinLim(target, fftSize, hop, 10, N)
    const explicitZero = griffinLim(target, fftSize, hop, 10, N, undefined, 0)
    for (let i = 0; i < vanilla.length; i++) {
      expect(explicitZero[i]).toBeCloseTo(vanilla[i], 6)
    }
  })

  it('accelerated (momentum) converges faster than vanilla at equal iterations', () => {
    const iters = 20
    const vanilla = griffinLim(target, fftSize, hop, iters, N)
    const accelerated = griffinLim(target, fftSize, hop, iters, N, undefined, 0.95)
    const errVanilla = spectralError(target, stftMagnitude(vanilla, fftSize, hop))
    const errAccel = spectralError(target, stftMagnitude(accelerated, fftSize, hop))
    expect(errAccel).toBeLessThan(errVanilla)
  })

  it('seeding the true phase converges far faster than zero phase', () => {
    const spec = stft(sine, fftSize, hop)
    const truePhase = spec.real.map((re, f) =>
      Float32Array.from(re, (v, k) => Math.atan2(spec.imag[f][k], v)),
    )
    const seeded = griffinLim(target, fftSize, hop, 1, N, undefined, 0, truePhase)
    const zeroPhase = griffinLim(target, fftSize, hop, 1, N)
    const errSeeded = spectralError(target, stftMagnitude(seeded, fftSize, hop))
    const errZero = spectralError(target, stftMagnitude(zeroPhase, fftSize, hop))
    expect(errSeeded).toBeLessThan(errZero)
  })
})
