// Inverse STFT via windowed overlap-add with COLA normalization.
//
// Each frame's half-spectrum is expanded to a full Hermitian-symmetric spectrum, inverse-
// transformed, multiplied by the synthesis Hann window, and summed into the output. The result
// is divided by the accumulated window-energy so that analysis+synthesis windowing cancels.

import FFT from 'fft.js'
import { hannWindow } from './stft'

const EPS = 1e-8

/** Reconstruct a time-domain signal from per-frame complex half-spectra. */
export function istft(
  real: Float32Array[],
  imag: Float32Array[],
  fftSize: number,
  hopSize: number,
  length?: number,
): Float32Array {
  const fft = new FFT(fftSize)
  const win = hannWindow(fftSize)
  const frames = real.length
  const bins = fftSize / 2 + 1

  const outLen = (frames - 1) * hopSize + fftSize
  const out = new Float32Array(outLen)
  const norm = new Float32Array(outLen)

  const spectrum = fft.createComplexArray()
  const timeComplex = fft.createComplexArray()

  for (let f = 0; f < frames; f++) {
    const re = real[f]
    const im = imag[f]
    // lower half
    for (let k = 0; k < bins; k++) {
      spectrum[2 * k] = re[k]
      spectrum[2 * k + 1] = im[k]
    }
    // Hermitian symmetry for the upper half
    for (let k = bins; k < fftSize; k++) {
      const mirror = fftSize - k
      spectrum[2 * k] = re[mirror]
      spectrum[2 * k + 1] = -im[mirror]
    }

    fft.inverseTransform(timeComplex, spectrum)

    const start = f * hopSize
    for (let n = 0; n < fftSize; n++) {
      const sample = timeComplex[2 * n] // real part (already scaled by 1/size)
      const w = win[n]
      out[start + n] += sample * w
      norm[start + n] += w * w
    }
  }

  for (let i = 0; i < outLen; i++) {
    if (norm[i] > EPS) out[i] /= norm[i]
  }

  if (length != null && length !== outLen) {
    return out.slice(0, length)
  }
  return out
}
