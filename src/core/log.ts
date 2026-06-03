// Log-magnitude scaling between linear STFT magnitudes and a stored [0,1] value.
//
// The curve is a fixed-floor dB mapping. The forward pass normalizes by the matrix's global
// maximum, so the absolute scale is discarded — this is fine because reconstruction only needs
// relative magnitudes (the output audio is peak-normalized for playback). Because the curve is
// fixed, the decoder inverts it without any extra header fields.

export const FLOOR_DB = -80
const FLOOR_LINEAR = 10 ** (FLOOR_DB / 20) // smallest relative magnitude above the floor

/** Map a normalized magnitude (0..1) to a stored value (0..1) via the dB curve. */
function encode(norm: number): number {
  if (norm <= FLOOR_LINEAR) return 0
  const db = 20 * Math.log10(norm)
  const s = (db - FLOOR_DB) / -FLOOR_DB
  return s < 0 ? 0 : s > 1 ? 1 : s
}

/** Map a stored value (0..1) back to a relative linear magnitude (0..1). */
function decode(s: number): number {
  if (s <= 0) return 0
  const db = s * -FLOOR_DB + FLOOR_DB
  return 10 ** (db / 20)
}

/** Forward: linear magnitudes -> stored values in [0,1], normalized by the global max. */
export function forwardLogScale(mag: Float32Array[]): Float32Array[] {
  let max = 0
  for (const frame of mag) {
    for (let k = 0; k < frame.length; k++) {
      if (frame[k] > max) max = frame[k]
    }
  }
  const inv = max > 0 ? 1 / max : 0
  return mag.map((frame) => {
    const out = new Float32Array(frame.length)
    for (let k = 0; k < frame.length; k++) out[k] = encode(frame[k] * inv)
    return out
  })
}

/** Inverse: stored values in [0,1] -> relative linear magnitudes in [0,1]. */
export function inverseLogScale(values: Float32Array[]): Float32Array[] {
  return values.map((frame) => {
    const out = new Float32Array(frame.length)
    for (let k = 0; k < frame.length; k++) out[k] = decode(frame[k])
    return out
  })
}
