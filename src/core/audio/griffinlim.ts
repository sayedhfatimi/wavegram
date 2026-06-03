// Griffin-Lim phase recovery. Given a magnitude spectrogram (phase discarded), iteratively
// estimate a time-domain signal whose STFT magnitude matches the target:
//
//   1. start from the target magnitude with zero phase
//   2. inverse STFT -> candidate signal
//   3. forward STFT -> take its phase, re-impose the target magnitude
//   4. repeat
//
// With `momentum` > 0 this becomes the Fast Griffin-Lim algorithm (Perraudin et al., 2013):
// the next iterate is extrapolated past the latest magnitude-projected spectrum, which
// converges in fewer iterations. `momentum` = 0 is exactly the classic algorithm.
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
  momentum = 0,
  initialPhase?: Float32Array[],
): Float32Array {
  const frames = magnitude.length
  const bins = frames > 0 ? magnitude[0].length : 0

  // initial estimate: target magnitude with either zero phase or, when provided, the
  // stored phase seed (mag * e^{i*phase}), which gives Griffin-Lim a strong head start.
  let estReal: Float32Array[]
  let estImag: Float32Array[]
  if (initialPhase) {
    estReal = magnitude.map((m, f) => {
      const re = new Float32Array(bins)
      for (let k = 0; k < bins; k++) re[k] = m[k] * Math.cos(initialPhase[f][k])
      return re
    })
    estImag = magnitude.map((m, f) => {
      const im = new Float32Array(bins)
      for (let k = 0; k < bins; k++) im[k] = m[k] * Math.sin(initialPhase[f][k])
      return im
    })
  } else {
    estReal = magnitude.map((m) => Float32Array.from(m))
    estImag = magnitude.map(() => new Float32Array(bins))
  }

  // the previous iteration's magnitude-projected spectrum (for momentum extrapolation)
  let prevReal: Float32Array[] | null = null
  let prevImag: Float32Array[] | null = null

  for (let iter = 0; iter < iterations; iter++) {
    const signal = istft(estReal, estImag, fftSize, hopSize, length)
    const spec = stft(signal, fftSize, hopSize)

    // magnitude projection: re-impose target magnitude on the recovered phase
    const projReal: Float32Array[] = []
    const projImag: Float32Array[] = []
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
      projReal.push(re)
      projImag.push(im)
    }

    // next estimate: plain projection, or accelerated extrapolation when momentum > 0
    if (momentum > 0 && prevReal && prevImag) {
      const nextReal: Float32Array[] = []
      const nextImag: Float32Array[] = []
      for (let f = 0; f < frames; f++) {
        const re = new Float32Array(bins)
        const im = new Float32Array(bins)
        const pr = prevReal[f]
        const pi = prevImag[f]
        for (let k = 0; k < bins; k++) {
          re[k] = projReal[f][k] + momentum * (projReal[f][k] - pr[k])
          im[k] = projImag[f][k] + momentum * (projImag[f][k] - pi[k])
        }
        nextReal.push(re)
        nextImag.push(im)
      }
      estReal = nextReal
      estImag = nextImag
    } else {
      estReal = projReal
      estImag = projImag
    }

    prevReal = projReal
    prevImag = projImag

    onProgress?.(iter + 1, iterations)
  }

  // final signal: the last magnitude-consistent (projected) spectrum, not the extrapolated one
  return istft(prevReal ?? estReal, prevImag ?? estImag, fftSize, hopSize, length)
}
