// Shared parameter types and defaults for the Wavegram codec.

/** Magnitude storage precision in the spectrogram pixel region. */
export type Precision = 0 | 1 // 0 = 8-bit grayscale, 1 = 16-bit packed across RGB

/** Reconstruction parameters carried in the self-describing image header. */
export interface WavegramHeader {
  version: number // 4-bit schema version
  precision: Precision // reserved bit 0
  hasPhase: boolean // reserved bit 1: B channel holds quantized phase (16-bit only)
  sampleRate: number // 24-bit, e.g. 16000
  fftSize: number // 10-bit FFT window size, e.g. 1024
  hopSize: number // 10-bit hop size, e.g. 512
  sampleCount: number // 32-bit original sample count (for precise trim)
  channels: number // 8-bit, 1 = mono
}

export const MAGIC = 0x41554456 // "AUDV"
// v2 adds the optional phase-seed flag (carried in the previously-spare reserved bit).
// v1 images decode unchanged: their spare bit is 0, so hasPhase reads false.
export const SCHEMA_VERSION = 2

export const DEFAULTS = {
  sampleRate: 16000,
  fftSize: 1024,
  hopSize: 512,
  maxDurationSec: 60,
  channels: 1,
  precision: 1 as Precision,
} as const

/** Number of frequency bins for a given FFT size: window/2 + 1. */
export function freqBins(fftSize: number): number {
  return fftSize / 2 + 1
}

/** Reconstruction quality settings: iteration count and Fast-Griffin-Lim momentum. */
export interface QualitySettings {
  iterations: number
  momentum: number
}

export const GRIFFIN_LIM_PRESETS = {
  fast: { iterations: 32, momentum: 0 },
  default: { iterations: 50, momentum: 0 },
  quality: { iterations: 100, momentum: 0 },
  // Fast Griffin-Lim: momentum lets fewer iterations reach comparable fidelity.
  accelerated: { iterations: 32, momentum: 0.9 },
} as const satisfies Record<string, QualitySettings>

export type QualityPreset = keyof typeof GRIFFIN_LIM_PRESETS
