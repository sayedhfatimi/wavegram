// Griffin-Lim phase recovery. Given a magnitude spectrogram (phase discarded), iteratively
// estimate a time-domain signal whose STFT magnitude matches the target:
//
//   1. start from the target magnitude with zero phase
//   2. inverse STFT -> candidate signal
//   3. forward STFT -> take its phase, re-impose the target magnitude
//   4. repeat
//
// Pure and worker-safe (no DOM). `onProgress(done, total)` fires once per completed iteration.

import { istft } from './istft'
import { stft } from './stft'

export type ProgressFn = (done: number, total: number) => void

export function griffinLim(
  magnitude: Float32Array[],
  fftSize: number,
  hopSize: number,
  iterations: number,
  length: number,
  onProgress?: ProgressFn,
): Float32Array {
  const frames = magnitude.length
  const bins = frames > 0 ? magnitude[0].length : 0

  // initial estimate: target magnitude, zero phase
  let real: Float32Array[] = magnitude.map((m) => Float32Array.from(m))
  let imag: Float32Array[] = magnitude.map(() => new Float32Array(bins))

  for (let iter = 0; iter < iterations; iter++) {
    const signal = istft(real, imag, fftSize, hopSize, length)
    const spec = stft(signal, fftSize, hopSize)

    // re-impose target magnitude on the recovered phase
    const nextReal: Float32Array[] = []
    const nextImag: Float32Array[] = []
    for (let f = 0; f < frames; f++) {
      const re = new Float32Array(bins)
      const im = new Float32Array(bins)
      const sRe = spec.real[f]
      const sIm = spec.imag[f]
      const mag = magnitude[f]
      for (let k = 0; k < bins; k++) {
        const phaseMag = Math.hypot(sRe[k], sIm[k]) || 1
        re[k] = (mag[k] * sRe[k]) / phaseMag
        im[k] = (mag[k] * sIm[k]) / phaseMag
      }
      nextReal.push(re)
      nextImag.push(im)
    }
    real = nextReal
    imag = nextImag

    onProgress?.(iter + 1, iterations)
  }

  return istft(real, imag, fftSize, hopSize, length)
}
