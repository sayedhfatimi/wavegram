// Forward pipeline: normalized mono PCM -> self-describing Wavegram image (RGBA pixels).
//
//   STFT magnitude -> log scaling -> pack pixels -> build header -> compose image
//
// Pure (no DOM): returns a PixelRegion the UI turns into a PNG via canvas.

import { stftMagnitude } from './audio/stft'
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
): PixelRegion {
  const mag = stftMagnitude(samples, fftSize, hopSize)
  const scaled = forwardLogScale(mag)
  const region = packSpectrogram(scaled, precision)

  const header: WavegramHeader = {
    version: SCHEMA_VERSION,
    precision,
    sampleRate,
    fftSize,
    hopSize,
    sampleCount,
    channels: DEFAULTS.channels,
  }
  return composeImage(packHeader(header), region)
}
