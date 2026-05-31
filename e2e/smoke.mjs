// End-to-end browser smoke test against the built app (vite preview on :4173).
// Drives the real UI: synthesize a WAV in-page, run it through the Forward tab to produce a
// Wavegram PNG, then feed that PNG into the Backward tab and reconstruct a WAV via the worker.
// Verifies validation badges, metadata, and a non-trivial WAV download — the full round trip
// through canvas + PNG codec + Web Worker that the unit tests can't cover.

import { chromium } from 'playwright-core'

const EXE =
  process.env.WAVEGRAM_CHROME ||
  `${process.env.HOME}/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`
const URL = 'http://localhost:4173/'

function makeWavDataUrl() {
  // 0.5s, 16kHz mono, two tones — built as a base64 WAV data URL.
  const sr = 16000
  const n = sr / 2
  const data = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const v = 0.6 * Math.sin(2 * Math.PI * 300 * t) + 0.3 * Math.sin(2 * Math.PI * 700 * t)
    data[i] = Math.max(-1, Math.min(1, v)) * 32767
  }
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28)
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  Buffer.from(data.buffer).copy(buf, 44)
  return 'data:audio/wav;base64,' + buf.toString('base64')
}

const fail = (m) => { console.error('FAIL:', m); process.exit(1) }

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(URL, { waitUntil: 'networkidle' })
if (!(await page.getByRole('heading', { name: 'Wavegram' }).isVisible())) fail('app did not render')

// --- Forward tab: upload synthetic WAV, generate PNG ---
const wavBytes = Buffer.from(makeWavDataUrl().split(',')[1], 'base64')
await page.locator('input[type="file"][accept="audio/*"]').setInputFiles({
  name: 'tone.wav', mimeType: 'audio/wav', buffer: wavBytes,
})
await page.getByText(/Hz mono/).waitFor({ timeout: 5000 })
await page.getByRole('button', { name: 'Generate Wavegram' }).click()

const dlForward = await page.waitForEvent('download', {
  predicate: (d) => d.suggestedFilename().endsWith('.wavegram.png'),
  timeout: 15000,
}).catch(() => null)
// the download button only appears after generation; click it
await page.getByRole('button', { name: 'Download PNG' }).waitFor({ timeout: 10000 })
const [pngDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Download PNG' }).click(),
])
const pngPath = await pngDownload.path()
if (!pngPath) fail('no PNG produced')
const { statSync } = await import('node:fs')
if (statSync(pngPath).size < 1000) fail('PNG suspiciously small')
console.log('OK: forward produced PNG', statSync(pngPath).size, 'bytes')
void dlForward

// --- Backward tab: feed the PNG back in, reconstruct ---
await page.getByRole('tab', { name: 'Image → Audio' }).click()
await page.locator('input[type="file"][accept="image/png"]').setInputFiles(pngPath)

await page.getByText('Magic ✓').waitFor({ timeout: 5000 })
await page.getByText('CRC-16 ✓').waitFor({ timeout: 5000 })
console.log('OK: validation badges show Magic ✓ / CRC-16 ✓')

// metadata sanity: the FFT size value renders in its <dd>
const fftShown = await page.locator('dd', { hasText: /^1024$/ }).first().isVisible().catch(() => false)
if (!fftShown) fail('metadata FFT size not displayed')
console.log('OK: metadata panel shows FFT size 1024')

await page.getByRole('button', { name: 'Reconstruct WAV' }).click()
const [wavDownload] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.getByRole('button', { name: 'Download WAV' }).waitFor({ timeout: 30000 }).then(
    () => page.getByRole('button', { name: 'Download WAV' }).click(),
  ),
])
const wavPath = await wavDownload.path()
const wavSize = statSync(wavPath).size
// 0.5s 16kHz 16-bit mono ≈ 16044 bytes
if (wavSize < 10000) fail(`reconstructed WAV too small: ${wavSize}`)
console.log('OK: backward reconstructed WAV', wavSize, 'bytes')

if (errors.length) fail('console/page errors:\n' + errors.join('\n'))

await browser.close()
console.log('\nE2E PASSED ✓')
