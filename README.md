<p align="center">
  <img src="docs/wavegram-banner.png" alt="Wavegram" width="520" />
</p>

Turn audio into a self-describing spectrogram image — and reconstruct the audio back from
that image. Wavegram is a two-tab single-page app that runs **entirely in your browser**:
no server, no uploads, no network calls. The output is an ordinary PNG that carries
everything needed to rebuild the sound inside its own pixels.

It's built for the voice-message use case (Opus/OGG voice notes, 16 kHz mono), but works
on any audio file up to 60 seconds.

```
┌───────────────────────────────────────────────────────┐
│                                                       │
│ Rows 0-15    Metadata header                          │
│              magic · version · params · CRC           │
│              16 px tall: two rows of 8x8 B&W squares  │
│                                                       │
├─ Rows 16+ ────────────────────────────────────────────┤
│                                                       │
│ Spectrogram                                           │
│              X = time         (left -> right)         │
│              Y = frequency    (low at the bottom)     │
│              brightness / colour = magnitude          │
│                                                       │
└───────────────────────────────────────────────────────┘
```

## How it works

**Audio ➔ Image (Forward tab)**
decode (Web Audio) ➔ mono mixdown ➔ resample to 16 kHz ➔ peak-normalize ➔ cap at 60 s ➔
STFT with a Hann window (FFT 1024 / hop 512) ➔ log-magnitude spectrogram ➔ write the
16-px metadata header ➔ export PNG.

**Image ➔ Audio (Backward tab)**
read the PNG ➔ reject lossy formats ➔ validate magic bytes + CRC-16 ➔ display the decoded
metadata ➔ recover linear magnitudes ➔ **Griffin-Lim phase recovery in a Web Worker** ➔
overlap-add ➔ trim to the original sample count ➔ download WAV.

Phase is discarded in the forward direction and recovered probabilistically (Griffin-Lim)
on the way back, so the reconstruction is faithful but not bit-exact — that's inherent to a
magnitude-only spectrogram, not a bug.

## Self-describing format

Every reconstruction parameter lives in the image, so any Wavegram PNG decodes with no
external state. The header is a 140-bit structure rendered as 8×8 black/white squares
(two rows, 70 squares each) and protected by a CRC-16:

| Field | Bits | Notes |
|---|---|---|
| Magic | 32 | `0x41554456` ("AUDV") |
| Version | 4 | schema version |
| Precision flag | 1 | reserved bit 0 — see below |
| Reserved | 1 | spare |
| Sample rate | 24 | e.g. 16000 |
| FFT size | 11 | e.g. 1024 |
| Hop size | 11 | e.g. 512 |
| Sample count | 32 | for exact trim on reconstruction |
| Channels | 8 | `0x01` = mono |
| CRC-16 | 16 | CCITT, over all preceding bits |

> The FFT/hop fields are 11 bits each (the original 10-bit spec couldn't hold 1024). The two
> extra bits come from the reserved field, keeping the header at exactly 140 bits.

**Magnitude precision** is header-flagged:

- **16-bit** (default) — each magnitude packed across the R (high byte) and G (low byte)
  channels. Much cleaner reconstruction; this is the recommended mode.
- **8-bit** grayscale — the spec-literal single-channel encoding, smaller but with an audible
  quantization floor.

PNG only. JPEG/WebP and other lossy formats are rejected by signature at the decoder, because
their compression corrupts the magnitude values.

## Quick start

```sh
bun install
bun run dev          # http://localhost:5173
```

1. **Audio ➔ Image**: pick an audio file **or record one in the browser**, optionally adjust
   FFT size / precision, click *Generate Wavegram*, download the PNG.
2. **Image ➔ Audio**: load that PNG, confirm the Magic ✓ / CRC ✓ badges, choose a Griffin-Lim
   quality preset (Fast 32 / Default 50 / Quality 100), reconstruct, download the WAV.

### On mobile

Both pickers are large tap targets that open your **photo library / Files** on a phone, and on
desktop also accept **drag-and-drop** or **paste**.

- **Audio ➔ Image**: pick an existing file, or tap **Record audio** to capture a voice note
  in-browser — handy on iOS, where the native file picker has no built-in recorder. Recording
  needs a secure context (HTTPS, or `localhost` in dev) and microphone permission.
- **Image ➔ Audio**: a Wavegram you received and saved is one tap away. However it arrives, the
  PNG must be the *original, unmodified* file — a screenshot, a re-saved copy, or a **photo of a
  spectrogram** loses the exact pixel values and fails the CRC check (see Scope below).

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Vite dev server with HMR |
| `bun run build` | Type-check (`tsc -b`) + production build to `dist/` |
| `bun run preview` | Serve the built bundle |
| `bun test` | Unit + numerical round-trip tests (Vitest) |
| `bun run typecheck` | Type-check without emitting |
| `bun run e2e` | Headless-browser smoke test of the full UI round trip (Playwright) |

### Round-trip a real file (listening test)

```sh
bun scripts/roundtrip-file.mjs <input-audio> [outDir] [iterations]
```

Decodes via ffmpeg, runs the complete pipeline through a real PNG, and writes
`<name>.original.wav`, `<name>.wavegram.png`, and `<name>.reconstructed.wav` for an A/B
comparison, printing the spectral-convergence error.

## Project layout

```
src/
  core/                 framework-agnostic DSP + codec (pure, unit-tested)
    audio/              decode · stft · istft · griffinlim · wav
    image/              crc16 · header · squares · spectrogram · png · codec
    log.ts              log-magnitude scaling
    params.ts           defaults + shared types
    forward.ts          audio ➔ image pipeline
    backward.ts         image ➔ magnitude pipeline
  workers/
    reconstruct.worker.ts   Griffin-Lim off the main thread
  ui/                   React components (forward/ + backward/ tabs, hooks)
  components/ui/         shadcn/ui primitives
e2e/smoke.mjs           Playwright end-to-end test
scripts/roundtrip-file.mjs   CLI round-trip helper
```

The DSP and codec logic is deliberately kept free of any DOM or React dependency, so it runs
identically in Vitest (Node), the browser, and the Web Worker.

## Tech stack

Vite · React · TypeScript · Tailwind · shadcn/ui · [`fft.js`](https://github.com/indutny/fft.js)
· [`audiobuffer-to-wav`](https://github.com/Jam3/audiobuffer-to-wav) · native Web Audio /
Canvas APIs. Package manager: **bun**.

## Scope (v1)

Mono audio, ≤ 60 seconds, PNG input only. The PNG can be picked from your photo library / Files
on mobile, or dropped/pasted on desktop — but it must be the original, unmodified file. *Camera
capture* (photographing a spectrogram) is intentionally **not** supported: perspective and
lighting distortion can't preserve the magnitude values, so a photo fails the CRC and can't be
faithfully reconstructed.
