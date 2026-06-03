// Viridis colormap approximation via linear interpolation between control points.
// Used to render a legible false-color spectrogram preview (the literal encoded
// image packs magnitude across R+G and is not meant to be read by eye).

type RGB = [number, number, number]

// Canonical viridis samples at evenly spaced stops.
const STOPS: RGB[] = [
  [68, 1, 84], // 0.00
  [59, 82, 139], // 0.25
  [33, 145, 140], // 0.50
  [94, 201, 98], // 0.75
  [253, 231, 37], // 1.00
]

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Map t in [0,1] to an [r,g,b] viridis colour (each channel 0–255). */
export function viridis(t: number): RGB {
  const x = clamp01(t) * (STOPS.length - 1)
  const i = Math.min(Math.floor(x), STOPS.length - 2)
  const f = x - i
  const a = STOPS[i]
  const b = STOPS[i + 1]
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ]
}
