// Forward tab: audio file -> Wavegram PNG.

import { useCallback, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type DecodedAudio, decodeAudioFile } from '@/core/audio/decode'
import { encodeToImage } from '@/core/forward'
import { imageDataToPngBlob } from '@/core/image/png'
import { DEFAULTS, type Precision } from '@/core/params'
import { downloadBlob, regionToImageData } from '@/ui/lib/browser'

const FFT_OPTIONS = [256, 512, 1024, 2048]
const PRECISION_OPTIONS: { value: Precision; label: string }[] = [
  { value: 1, label: '16-bit (RGB packed) — best quality' },
  { value: 0, label: '8-bit (grayscale) — spec-literal' },
]

export function ForwardTab() {
  const [audio, setAudio] = useState<DecodedAudio | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [fftSize, setFftSize] = useState<number>(DEFAULTS.fftSize)
  const [precision, setPrecision] = useState<Precision>(DEFAULTS.precision)
  const [pngBlob, setPngBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const hopSize = fftSize / 2

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setPngBlob(null)
    setBusy(true)
    try {
      const decoded = await decodeAudioFile(file)
      setAudio(decoded)
      setFileName(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setAudio(null)
    } finally {
      setBusy(false)
    }
  }, [])

  const onProcess = useCallback(async () => {
    if (!audio) return
    setError(null)
    setBusy(true)
    try {
      const region = encodeToImage(
        audio.samples,
        audio.sampleRate,
        audio.sampleCount,
        fftSize,
        hopSize,
        precision,
      )
      const imageData = regionToImageData(region)
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = imageData.width
        canvas.height = imageData.height
        canvas.getContext('2d')?.putImageData(imageData, 0, 0)
      }
      setPngBlob(await imageDataToPngBlob(imageData))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [audio, fftSize, hopSize, precision])

  const outName = fileName.replace(/\.[^.]+$/, '') || 'wavegram'

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose an audio file</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground hover:file:opacity-90"
          />
          {audio && (
            <p className="text-sm text-muted-foreground">
              {fileName} — {audio.durationSec.toFixed(1)}s, {audio.sampleRate} Hz mono
            </p>
          )}
          {audio?.capped && (
            <Alert variant="destructive">
              <AlertTitle>Trimmed to {DEFAULTS.maxDurationSec}s</AlertTitle>
              <AlertDescription>
                Audio longer than {DEFAULTS.maxDurationSec} seconds is capped (v1 limit).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Parameters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">FFT window size</span>
            <Select value={String(fftSize)} onValueChange={(v) => setFftSize(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FFT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Hop size (auto = window / 2)</span>
            <span className="flex h-9 items-center font-mono">{hopSize}</span>
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Magnitude precision</span>
            <Select
              value={String(precision)}
              onValueChange={(v) => setPrecision(Number(v) as Precision)}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRECISION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={onProcess} disabled={!audio || busy}>
          {busy ? 'Working…' : 'Generate Wavegram'}
        </Button>
        {pngBlob && (
          <Button
            variant="secondary"
            onClick={() => downloadBlob(pngBlob, `${outName}.wavegram.png`)}
          >
            Download PNG
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className={pngBlob ? '' : 'hidden'}>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <canvas
            ref={canvasRef}
            className="max-w-full border bg-black [image-rendering:pixelated]"
          />
        </CardContent>
      </Card>
    </div>
  )
}
