// Backward pipeline (everything except Griffin-Lim, which runs in the worker):
//
//   read header -> validate -> extract spectrogram region -> unpack pixels -> undo log scaling
//
// Pure (no DOM): the UI feeds in RGBA from a decoded PNG.

import { numFrames } from './audio/stft'
import { readHeaderFromImage, readRegionFromImage } from './image/codec'
import { type DecodedHeader, unpackHeader } from './image/header'
import { unpackSpectrogram } from './image/spectrogram'
import { inverseLogScale } from './log'
import { freqBins, type WavegramHeader } from './params'

/** Read and validate the metadata header from a decoded image. */
export function readMetadata(rgba: Uint8ClampedArray, width: number): DecodedHeader {
  return unpackHeader(readHeaderFromImage(rgba, width))
}

/** Recover the (relative) linear magnitude matrix from a decoded image. */
export function extractMagnitude(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  header: WavegramHeader,
): Float32Array[] {
  const bins = freqBins(header.fftSize)
  if (height - 16 !== bins) {
    throw new Error(
      `Image height ${height} is inconsistent with FFT size ${header.fftSize} (expected ${bins + 16}px).`,
    )
  }
  const frames = numFrames(header.sampleCount, header.fftSize, header.hopSize)
  const region = readRegionFromImage(rgba, width, frames, bins)
  const values = unpackSpectrogram(region, frames, bins, header.precision)
  return inverseLogScale(values)
}
