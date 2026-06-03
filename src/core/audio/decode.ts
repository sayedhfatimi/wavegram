// Audio file -> normalized mono Float32 PCM at the target sample rate.
//
// The pure DSP helpers (mix / normalize / resample / cap) are unit-tested. `decodeAudioFile`
// is a thin Web Audio orchestration wrapper exercised in the running app.

import { DEFAULTS } from '../params'

/** Average all channels into a single mono channel (returns a fresh array). */
export function mixToMono(channels: Float32Array[]): Float32Array {
  const n = channels[0]?.length ?? 0
  const out = new Float32Array(n)
  const c = channels.length
  if (c === 0) return out
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let ch = 0; ch < c; ch++) sum += channels[ch][i]
    out[i] = sum / c
  }
  return out
}

/** Scale so the absolute peak becomes 1.0. All-zero input is returned unchanged. */
export function peakNormalize(samples: Float32Array): Float32Array {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
  }
  const out = new Float32Array(samples.length)
  if (peak === 0) return out
  const gain = 1 / peak
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}

/** Linear-interpolation resampler. Adequate for 16kHz voice; tail is clamped to the last sample. */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return samples.slice()
  const ratio = fromRate / toRate
  const outLen = Math.round(samples.length * (toRate / fromRate))
  const out = new Float32Array(outLen)
  const last = samples.length - 1
  for (let i = 0; i < outLen; i++) {
    const t = i * ratio
    const i0 = Math.floor(t)
    const frac = t - i0
    const a = samples[Math.min(i0, last)]
    const b = samples[Math.min(i0 + 1, last)]
    out[i] = a + (b - a) * frac
  }
  return out
}

/**
 * Windowed-sinc (Blackman) resampler with an anti-aliasing low-pass. When
 * downsampling, the sinc cutoff drops to the target Nyquist so high frequencies
 * are attenuated before sampling instead of folding back as aliases. Higher
 * quality than linear interpolation for music and wideband audio.
 */
export function resampleSinc(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
  lobes = 8,
): Float32Array {
  if (fromRate === toRate) return samples.slice()
  const ratio = fromRate / toRate
  const outLen = Math.round(samples.length * (toRate / fromRate))
  const out = new Float32Array(outLen)
  const last = samples.length - 1

  // Cutoff in cycles per source sample: 0.5 (source Nyquist) when upsampling,
  // lowered to the target Nyquist when downsampling.
  const fc = 0.5 * Math.min(1, toRate / fromRate)
  // Kernel half-width in source samples (more lobes -> sharper transition).
  const halfWidth = lobes / (2 * fc)

  for (let i = 0; i < outLen; i++) {
    const t = i * ratio
    const nStart = Math.ceil(t - halfWidth)
    const nEnd = Math.floor(t + halfWidth)
    let acc = 0
    let wsum = 0
    for (let n = nStart; n <= nEnd; n++) {
      if (n < 0 || n > last) continue
      const x = n - t
      const sincArg = 2 * fc * x
      const sinc = sincArg === 0 ? 1 : Math.sin(Math.PI * sincArg) / (Math.PI * sincArg)
      const u = (x + halfWidth) / (2 * halfWidth)
      const win =
        0.42 - 0.5 * Math.cos(2 * Math.PI * u) + 0.08 * Math.cos(4 * Math.PI * u)
      const w = sinc * win
      acc += samples[n] * w
      wsum += w
    }
    out[i] = wsum > 0 ? acc / wsum : 0
  }
  return out
}

/** Truncate to at most `maxSec` of audio. Reports whether truncation occurred. */
export function capSamples(
  samples: Float32Array,
  sampleRate: number,
  maxSec: number,
): { samples: Float32Array; capped: boolean } {
  const maxSamples = Math.floor(sampleRate * maxSec)
  if (samples.length <= maxSamples) return { samples, capped: false }
  return { samples: samples.slice(0, maxSamples), capped: true }
}

export interface DecodedAudio {
  samples: Float32Array // mono, normalized, at targetRate, capped
  sampleRate: number // targetRate
  sampleCount: number // samples.length (for precise reconstruction trim)
  durationSec: number
  capped: boolean
}

/** Decode an audio File to normalized mono PCM at the target sample rate (browser only). */
export async function decodeAudioFile(
  file: File,
  targetRate = DEFAULTS.sampleRate,
  maxSec = DEFAULTS.maxDurationSec,
): Promise<DecodedAudio> {
  const AudioCtx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
    const channels: Float32Array[] = []
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      channels.push(buffer.getChannelData(ch))
    }
    let mono = mixToMono(channels)
    mono = resampleSinc(mono, buffer.sampleRate, targetRate)
    mono = peakNormalize(mono)
    const { samples, capped } = capSamples(mono, targetRate, maxSec)
    return {
      samples,
      sampleRate: targetRate,
      sampleCount: samples.length,
      durationSec: samples.length / targetRate,
      capped,
    }
  } finally {
    void ctx.close()
  }
}
