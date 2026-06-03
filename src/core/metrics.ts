// Reconstruction quality metric shared by the app and the CLI round-trip helper.

/** Normalize a magnitude matrix by its global maximum (no-op if all zero). */
function normalizeByMax(m: Float32Array[]): Float32Array[] {
  let mx = 0
  for (const frame of m) {
    for (const v of frame) if (v > mx) mx = v
  }
  const inv = mx > 0 ? 1 / mx : 0
  return m.map((frame) => frame.map((v) => v * inv))
}

/**
 * Spectral convergence error between a target and an actual magnitude spectrogram.
 * Each matrix is normalized by its own global maximum, then compared as a relative
 * L2 difference over the overlapping frames. 0 is a perfect magnitude match; higher
 * is worse.
 */
export function spectralError(target: Float32Array[], actual: Float32Array[]): number {
  const a = normalizeByMax(target)
  const b = normalizeByMax(actual)
  let num = 0
  let den = 0
  const frames = Math.min(a.length, b.length)
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < a[f].length; k++) {
      const d = b[f][k] - a[f][k]
      num += d * d
      den += a[f][k] * a[f][k]
    }
  }
  return Math.sqrt(num / den)
}
