// Forward pipeline: normalized mono PCM -> self-describing Wavegram image (RGBA pixels).
//
//   STFT magnitude -> log scaling -> pack pixels -> build header -> compose image
//
// With `storePhase` (16-bit precision only) the per-bin STFT phase is quantized into the
// pixel B channel as a Griffin-Lim seed, recorded via the header's hasPhase flag.
//
// Pure (no DOM): returns a PixelRegion the UI turns into a PNG via canvas.

import { stft } from './audio/stft'
import { composeImage } from './image/codec'
import { packHeader } from './image/header'
import { type PixelRegion, packSpectrogram } from './image/spectrogram'
import { forwardLogScale } from './log'
import { DEFAULTS, type Precision, SCHEMA_VERSION, type WavegramHeader } from './params'

/** Encode mono samples into a full Wavegram image. */
export function encodeToImage(
  samples: Float32Array,
  sampleRate: number,
  sampleCount: number,
  fftSize: number,
  hopSize: number,
  precision: Precision,
  storePhase = false,
): PixelRegion {
  const spec = stft(samples, fftSize, hopSize)
  const mag = spec.real.map((re, f) => {
    const im = spec.imag[f]
    const m = new Float32Array(re.length)
    for (let k = 0; k < re.length; k++) m[k] = Math.hypot(re[k], im[k])
    return m
  })

  const hasPhase = storePhase && precision === 1
  const phase = hasPhase
    ? spec.real.map((re, f) => {
        const im = spec.imag[f]
        const p = new Float32Array(re.length)
        for (let k = 0; k < re.length; k++) p[k] = Math.atan2(im[k], re[k])
        return p
      })
    : undefined

  const scaled = forwardLogScale(mag)
  const region = packSpectrogram(scaled, precision, phase)

  const header: WavegramHeader = {
    version: SCHEMA_VERSION,
    precision,
    hasPhase,
    sampleRate,
    fftSize,
    hopSize,
    sampleCount,
    channels: DEFAULTS.channels,
  }
  return composeImage(packHeader(header), region)
}
