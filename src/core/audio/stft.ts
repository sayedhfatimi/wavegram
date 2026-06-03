// Short-Time Fourier Transform with a periodic Hann window.
//
// Framing is non-centered: frame i spans [i*hop, i*hop+fftSize), zero-padded past the signal
// end. The half-spectrum (fftSize/2 + 1 bins) is returned per frame, since the input is real.

import FFT from 'fft.js'
import { freqBins } from '../params'

export interface ComplexSTFT {
  real: Float32Array[] // [frame][bin]
  imag: Float32Array[]
  frames: number
  bins: number
}

/** Periodic Hann window of length `size` (w[n] = 0.5 - 0.5*cos(2πn/size)). */
export function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size)
  for (let n = 0; n < size; n++) {
    w[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / size)
  }
  return w
}

/** Number of frames produced for a signal of `len` samples. */
export function numFrames(len: number, fftSize: number, hopSize: number): number {
  if (len <= fftSize) return 1
  return 1 + Math.ceil((len - fftSize) / hopSize)
}

/** Forward STFT returning per-frame complex half-spectra. */
export function stft(
  samples: Float32Array,
  fftSize: number,
  hopSize: number,
): ComplexSTFT {
  const fft = new FFT(fftSize)
  const win = hannWindow(fftSize)
  const bins = freqBins(fftSize)
  const frames = numFrames(samples.length, fftSize, hopSize)

  const real: Float32Array[] = []
  const imag: Float32Array[] = []
  const spectrum = fft.createComplexArray()
  const frame = new Float64Array(fftSize)

  for (let f = 0; f < frames; f++) {
    const start = f * hopSize
    for (let n = 0; n < fftSize; n++) {
      const idx = start + n
      frame[n] = idx < samples.length ? samples[idx] * win[n] : 0
    }
    fft.realTransform(spectrum, frame)
    fft.completeSpectrum(spectrum)

    const re = new Float32Array(bins)
    const im = new Float32Array(bins)
    for (let k = 0; k < bins; k++) {
      re[k] = spectrum[2 * k]
      im[k] = spectrum[2 * k + 1]
    }
    real.push(re)
    imag.push(im)
  }

  return { real, imag, frames, bins }
}

/** Forward STFT returning only per-frame magnitudes. */
export function stftMagnitude(
  samples: Float32Array,
  fftSize: number,
  hopSize: number,
): Float32Array[] {
  const { real, imag } = stft(samples, fftSize, hopSize)
  return real.map((re, f) => {
    const im = imag[f]
    const mag = new Float32Array(re.length)
    for (let k = 0; k < re.length; k++) mag[k] = Math.hypot(re[k], im[k])
    return mag
  })
}
