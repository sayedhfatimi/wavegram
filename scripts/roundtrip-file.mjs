// Full Wavegram round trip on a real audio file, for listening tests.
//
//   <input audio> --ffmpeg--> 16kHz mono PCM --normalize/cap--> STFT -> log -> pack
//     -> REAL PNG (pngjs) -> read back -> recover magnitude -> Griffin-Lim -> WAV
//
// Writes three files to the output dir:
//   <name>.original.wav    the 16kHz mono normalized input (fair A/B reference)
//   <name>.wavegram.png    the self-describing spectrogram image
//   <name>.reconstructed.wav  the Griffin-Lim reconstruction
//
// Usage: node scripts/roundtrip-file.mjs <input> [outDir] [iterations]

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { PNG } from 'pngjs'

import { capSamples, peakNormalize } from '../src/core/audio/decode.ts'
import { griffinLim } from '../src/core/audio/griffinlim.ts'
import { stftMagnitude } from '../src/core/audio/stft.ts'
import { encodeWav } from '../src/core/audio/wav.ts'
import { extractMagnitude, readMetadata } from '../src/core/backward.ts'
import { encodeToImage } from '../src/core/forward.ts'
import { DEFAULTS } from '../src/core/params.ts'

const input = process.argv[2]
const outDir = process.argv[3] || `${process.env.HOME}/Downloads`
const iterations = Number(process.argv[4] || 100)
if (!input) {
  console.error(
    'usage: node scripts/roundtrip-file.mjs <input audio> [outDir] [iterations]',
  )
  process.exit(1)
}

const SR = DEFAULTS.sampleRate
const FFT = DEFAULTS.fftSize
const HOP = DEFAULTS.hopSize
const name = basename(input, extname(input))

// 1. Decode to 16kHz mono float32 PCM via ffmpeg (stdout).
console.log(`Decoding ${input} → ${SR}Hz mono…`)
const raw = execFileSync(
  'ffmpeg',
  ['-v', 'error', '-i', input, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
  { maxBuffer: 1 << 30 },
)
let samples = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4))

// 2. Normalize + cap to 60s (mirrors the in-app decode path).
samples = peakNormalize(samples)
const capped = capSamples(samples, SR, DEFAULTS.maxDurationSec)
samples = capped.samples
const N = samples.length
console.log(
  `  ${(N / SR).toFixed(1)}s, ${N} samples${capped.capped ? ' (capped to 60s)' : ''}`,
)

// 3. Reference original (post-normalize, same SR/mono) for a fair comparison.
const originalWav = encodeWav(samples, SR)
writeFileSync(join(outDir, `${name}.original.wav`), Buffer.from(originalWav))

// 4. Forward → real PNG.
console.log('Encoding spectrogram → PNG…')
const region = encodeToImage(samples, SR, N, FFT, HOP, DEFAULTS.precision)
const png = new PNG({ width: region.width, height: region.height })
png.data = Buffer.from(region.rgba.buffer, region.rgba.byteOffset, region.rgba.byteLength)
const pngBytes = PNG.sync.write(png)
writeFileSync(join(outDir, `${name}.wavegram.png`), pngBytes)

// 5. Read PNG back, validate, recover magnitude.
const decoded = PNG.sync.read(Buffer.from(pngBytes))
const rgba = new Uint8ClampedArray(
  decoded.data.buffer,
  decoded.data.byteOffset,
  decoded.data.byteLength,
)
const meta = readMetadata(rgba, decoded.width)
console.log(`  header: magic=${meta.magicValid} crc=${meta.crcValid}`, meta.header)
if (!meta.magicValid || !meta.crcValid || !meta.header) {
  console.error('header validation failed')
  process.exit(1)
}
const targetMag = extractMagnitude(rgba, decoded.width, decoded.height, meta.header)

// 6. Griffin-Lim reconstruction.
console.log(`Griffin-Lim (${iterations} iterations)…`)
const recon = griffinLim(targetMag, FFT, HOP, iterations, N)
const reconNorm = peakNormalize(recon)
const reconWav = encodeWav(reconNorm, SR)
writeFileSync(join(outDir, `${name}.reconstructed.wav`), Buffer.from(reconWav))

// 7. Spectral-convergence metric (how close the reconstruction's magnitude is to the target).
function spectralError(a, b) {
  const norm = (m) => {
    let mx = 0
    for (const f of m) for (const v of f) if (v > mx) mx = v
    const inv = mx > 0 ? 1 / mx : 0
    return m.map((f) => f.map((v) => v * inv))
  }
  const na = norm(a),
    nb = norm(b)
  let num = 0,
    den = 0
  const frames = Math.min(na.length, nb.length)
  for (let f = 0; f < frames; f++)
    for (let k = 0; k < na[f].length; k++) {
      const d = nb[f][k] - na[f][k]
      num += d * d
      den += na[f][k] * na[f][k]
    }
  return Math.sqrt(num / den)
}
const err = spectralError(targetMag, stftMagnitude(recon, FFT, HOP))
console.log(
  `\nSpectral convergence error: ${(err * 100).toFixed(2)}%  (lower = closer; ~0 is perfect magnitude match)`,
)
console.log(`Wrote to ${outDir}:`)
console.log(`  ${name}.original.wav`)
console.log(`  ${name}.wavegram.png`)
console.log(`  ${name}.reconstructed.wav`)
